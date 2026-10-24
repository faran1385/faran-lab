import {NodeInternal} from "../internals/NodeInternal.ts";
import {BufferInternal} from "../internals/BufferInternal.ts";
import {PipelineInteractor} from "../Representations/PipelineInteractor.ts";
import {mat4} from "../../packages/math/matrix/mat4.ts";
import {schedulePreFrame} from "./PreFrameQueue.ts";
import {Source} from "./Source.ts";
import type {MeshWrapper} from "../wrappers/MeshWrapper.ts";
import type {MeshAdaptor} from "./MeshAdaptor.ts";
import type {PrimitiveAdaptor} from "./PrimitiveAdaptor.ts";
import type {RenderContext} from "../Renderer/RenderContext.ts";

/** What the adapter reads from a node wrapper to compute its local matrix. */
export interface TransformSource {
    getTranslation(): Float32Array;

    getRotation(): Float32Array;

    getScale(): Float32Array;
}

/**
 * Translates a node. Three jobs, all done before the frame:
 *
 * 1. World matrix. The node's world matrix lives in `buffer` (a BufferInternal, bound into the node's bind group when
 *    `needNodeTransform` is given). A transform change marks this node and, through `worldChanged`, every descendant
 *    stale; each recomputes `parentWorld * local` once when the queue is flushed, pulling its parent first.
 * 2. Pipelines. For every primitive of the node's mesh it builds the pipeline representations the render side will
 *    create GPU pipelines from (stored on the NodeInternal, keyed by primitive uuid).
 * 3. Structure. It mirrors the wrapper tree (parent/children) and tells whoever listens (the scene adapter) when the
 *    tree or a mesh assignment changed.
 *
 * Frame formats and the group 0 bind group are render-side inputs: they live on the NodeInternal (setFrame /
 * setSceneBindgroup) and this adapter only applies what is stored there to the pipelines it builds.
 */
export class NodeAdaptor {
    readonly internal: NodeInternal;
    readonly buffer = new BufferInternal(mat4.create().buffer, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

    /** Parent to children: this node's world matrix is stale, so is every descendant's. */
    readonly worldChanged = new Source<void>();
    /** Child to parent: the tree below this node, or a mesh assignment in it, changed. */
    readonly structureChanged = new Source<void>();

    private readonly world = new Float32Array(this.buffer.getData());
    private readonly local = mat4.create();
    private source: TransformSource | null = null;
    private parent: NodeAdaptor | null = null;
    private readonly children = new Map<string, NodeAdaptor>();
    private childrenArray: readonly NodeAdaptor[] = [];

    private worldDirty = true;
    private readonly worldTask = () => this.ensureWorld();


    private mesh: MeshAdaptor | null = null;
    private readonly watchedPrimitives = new Map<string, PrimitiveAdaptor>();
    private readonly task = (ctx: RenderContext) => this.ensure(ctx);
    private readonly onDependencyChange = () => this.invalidate();
    private dirty = true;


    constructor(internal?: NodeInternal) {
        this.internal = internal ?? new NodeInternal();
        if (this.internal.nodeBindgroupAt !== null) this.internal.bindgroupInteractor.setUniform(0, this.buffer, GPUShaderStage.VERTEX)
        schedulePreFrame(this.worldTask);
    }

    // -- transform ----------------------------------------------------------

    /** The wrapper whose translation/rotation/scale this adapter turns into a world matrix. */
    setSource(source: TransformSource): void {
        this.source = source;
        this.invalidateWorld();
    }

    /**
     * Invariant: a stale node implies all its descendants are stale. So a node that is already stale does not
     * notify again, and a newly attached child (setParent) marks itself.
     */
    invalidateWorld(): void {
        // Walk the subtree iteratively: deep hierarchies must not recurse through Source.notify().
        const stack: NodeAdaptor[] = [this];
        while (stack.length > 0) {
            const node = stack.pop()!;
            if (!node.worldDirty) {
                node.worldDirty = true;
                node.worldChanged.notify();
            }
            schedulePreFrame(node.worldTask);
            const children = node.childrenArray;
            for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
        }
    }

    /** The world matrix as of the last flush. */
    getWorldMatrix(): Float32Array {
        return this.world;
    }

    ensureWorld(): void {
        // Pull dirty ancestors iteratively, then compute matrices parent-to-child.
        const chain: NodeAdaptor[] = [];
        let node: NodeAdaptor | null = this;
        while (node && node.worldDirty) {
            chain.push(node);
            node = node.parent;
        }

        for (let i = chain.length - 1; i >= 0; i--) {
            const current = chain[i];
            const source = current.source;
            if (source) mat4.compose(current.local, source.getTranslation(), source.getRotation(), source.getScale());
            else mat4.identity(current.local);

            if (current.parent) mat4.mul(current.world, current.parent.world, current.local);
            else current.world.set(current.local);

            current.worldDirty = false;
            current.buffer.markDirty();
        }
    }

    // -- tree ---------------------------------------------------------------

    getChildren(): readonly NodeAdaptor[] {
        return this.childrenArray;
    }

    addChild(child: NodeAdaptor): void {
        if (this.children.has(child.internal.uuid)) return;
        this.children.set(child.internal.uuid, child);
        this.childrenArray = Array.from(this.children.values());
        child.setParent(this);
        this.notifyStructureChanged();
    }

    removeChild(child: NodeAdaptor): void {
        if (!this.children.delete(child.internal.uuid)) return;
        this.childrenArray = Array.from(this.children.values());
        child.setParent(null);
        this.notifyStructureChanged();
    }

    private setParent(parent: NodeAdaptor | null): void {
        this.parent = parent;
        this.invalidateWorld();
    }

    /**
     * Notify structure observers from this node up to the root without recursive child-to-parent Source callbacks.
     * Deep imported hierarchies can be thousands of nodes tall.
     */
    private notifyStructureChanged(): void {
        let node: NodeAdaptor | null = this;
        while (node) {
            node.structureChanged.notify();
            node = node.parent;
        }
    }

    // -- mesh and pipelines -------------------------------------------------

    setMesh(mesh: MeshWrapper | null) {
        this.mesh?.changed.unsubscribe(this.internal.uuid);
        this.mesh = mesh?.adaptor ?? null;
        this.mesh?.changed.subscribe(this.internal.uuid, this.onDependencyChange);
        this.internal.setMesh(this.mesh?.internal ?? null);
        this.invalidate();
        this.notifyStructureChanged();
    }

    invalidate() {
        this.dirty = true;
        schedulePreFrame(this.task);
    }

    ensure(ctx: RenderContext): void {

        const primitives = this.mesh ? this.mesh.getPrimitiveAdaptors() : [];
        this.syncWatched(primitives);
        for (const primitive of primitives) primitive.ensure();

        if (!this.dirty) return;
        this.dirty = false;
        this.rebuildPipelines(ctx, primitives);
    }

    /** Subscribes to primitives that joined the mesh and drops the ones that left it. */
    private syncWatched(primitives: readonly PrimitiveAdaptor[]): void {
        const wanted = new Set<string>();
        for (const primitive of primitives) wanted.add(primitive.internal.uuid);

        for (const [uuid, primitive] of this.watchedPrimitives) {
            if (wanted.has(uuid)) continue;
            primitive.changed.unsubscribe(this.internal.uuid);
            this.watchedPrimitives.delete(uuid);
        }
        for (const primitive of primitives) {
            const uuid = primitive.internal.uuid;
            if (this.watchedPrimitives.has(uuid)) continue;
            primitive.changed.subscribe(this.internal.uuid, this.onDependencyChange);
            this.watchedPrimitives.set(uuid, primitive);
        }
    }

    private rebuildPipelines(ctx: RenderContext, primitives: readonly PrimitiveAdaptor[]): void {

        const live = new Set<string>();

        for (const adaptor of primitives) {
            const primitive = adaptor.internal;
            const material = primitive.getMat();
            const geometry = primitive.getGeo();
            if (!material || !geometry) continue;
            live.add(primitive.uuid);

            const settings = adaptor.getPipelineSettings();
            if (!settings) continue;
            const buffers = Array.from(geometry.getVertexAttributes().entries())
                .sort(([a], [b]) => a - b)
                .map(([, attribute]) => attribute.getLayout()!);

            // Reuse by index so a material tweak that keeps the variant count keeps the same representations.
            const pipelines = this.internal.getPipelines().get(primitive.uuid) ?? [];
            while (pipelines.length < settings.cullModes.length) pipelines.push(new PipelineInteractor());
            pipelines.length = settings.cullModes.length;

            settings.cullModes.forEach((cullMode, i) => {
                const pipeline = pipelines[i];
                pipeline.setVertex(primitive.vertex);
                pipeline.setFragment(primitive.fragment);
                pipeline.setVertexBuffers(buffers);
                pipeline.setPrimitiveState({topology: "triangle-list", cullMode});
                pipeline.setMaterialState({blend: settings.blend, depthWriteEnabled: settings.depthWriteEnabled});
                pipeline.setFrame(ctx.frame);
                if (this.internal.sceneBindgroupAt !== null) pipeline.setBindgroup(this.internal.sceneBindgroupAt, ctx.sceneBindgroup);

                pipeline.setBindgroup(material.getGroup(), material.getBindgroupInteractor());
                if (this.internal.nodeBindgroupAt !== null) pipeline.setBindgroup(this.internal.nodeBindgroupAt, this.internal.bindgroupInteractor);
            });

            this.internal.setPipelines(primitive.uuid, pipelines);
        }

        for (const uuid of Array.from(this.internal.getPipelines().keys())) {
            if (!live.has(uuid)) this.internal.removePipelines(uuid);
        }


    }
}
