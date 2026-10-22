import {NodeInternal} from "../internals/NodeInternal.ts";
import {BufferInternal} from "../internals/BufferInternal.ts";
import {PipelineInteractor} from "../Representations/PipelineInteractor.ts";
import type {BindgroupInteractor} from "../Representations/BindgroupInteractor.ts";
import {mat4} from "../../packages/math/matrix/mat4.ts";
import {schedulePreFrame} from "./PreFrameQueue.ts";
import {Source} from "./Source.ts";
import type {MeshWrapper} from "../wrappers/MeshWrapper.ts";
import type {MeshAdaptor} from "./MeshAdaptor.ts";
import type {PrimitiveAdaptor} from "./PrimitiveAdaptor.ts";

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
    private readonly onParentWorldChange = () => this.invalidateWorld();
    private readonly onChildStructureChange = () => this.structureChanged.notify();

    private mesh: MeshAdaptor | null = null;
    private readonly watchedPrimitives = new Map<string, PrimitiveAdaptor>();
    private readonly task = () => this.ensure();
    private readonly onDependencyChange = () => this.invalidate();
    private dirty = true;

    constructor(internal?: NodeInternal, needNodeTransform?: {
        binding: number,
        visibility: GPUShaderStageFlags
    }) {
        this.internal = internal ?? new NodeInternal();
        if (needNodeTransform) {
            this.internal.bindgroupInteractor.setUniform(
                needNodeTransform.binding,
                this.buffer,
                needNodeTransform.visibility
            )
        }
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
        if (!this.worldDirty) {
            this.worldDirty = true;
            this.worldChanged.notify();
        }
        schedulePreFrame(this.worldTask);
    }

    /** The world matrix as of the last flush. */
    getWorldMatrix(): Float32Array {
        return this.world;
    }

    ensureWorld(): void {
        // by the invariant a clean parent has clean ancestors, so only a stale parent has to be brought up to date
        if (this.parent && this.parent.worldDirty) this.parent.ensureWorld();
        if (!this.worldDirty) return;
        this.worldDirty = false;

        const source = this.source;
        if (source) mat4.compose(this.local, source.getTranslation(), source.getRotation(), source.getScale());
        else mat4.identity(this.local);

        if (this.parent) mat4.mul(this.world, this.parent.world, this.local);
        else this.world.set(this.local);

        this.buffer.markDirty();
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
        child.structureChanged.subscribe(this.internal.uuid, this.onChildStructureChange);
        this.structureChanged.notify();
    }

    removeChild(child: NodeAdaptor): void {
        if (!this.children.delete(child.internal.uuid)) return;
        this.childrenArray = Array.from(this.children.values());
        child.setParent(null);
        child.structureChanged.unsubscribe(this.internal.uuid);
        this.structureChanged.notify();
    }

    private setParent(parent: NodeAdaptor | null): void {
        this.parent?.worldChanged.unsubscribe(this.internal.uuid);
        this.parent = parent;
        parent?.worldChanged.subscribe(this.internal.uuid, this.onParentWorldChange);
        this.invalidateWorld();
    }

    // -- mesh and pipelines -------------------------------------------------

    setMesh(mesh: MeshWrapper | null) {
        this.mesh?.changed.unsubscribe(this.internal.uuid);
        this.mesh = mesh?.adaptor ?? null;
        this.mesh?.changed.subscribe(this.internal.uuid, this.onDependencyChange);
        this.internal.setMesh(this.mesh?.internal ?? null);
        this.invalidate();
        this.structureChanged.notify();
    }

    invalidate() {
        this.dirty = true;
        schedulePreFrame(this.task);
    }

    ensure(): void {
        const primitives = this.mesh ? this.mesh.getPrimitiveAdaptors() : [];
        this.syncWatched(primitives);
        for (const primitive of primitives) primitive.ensure();

        if (!this.dirty) return;
        this.dirty = false;
        this.rebuildPipelines(primitives);
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

    /**
     * Applies an explicitly named scene/node binding to a pipeline representation.
     * Material bindings are primitive-specific and are supplied separately.
     */
    setBindingGroup(
        pipeline: PipelineInteractor,
        source: "scene" | "node",
        group: number,
        binding: BindgroupInteractor,
    ): void {
        // Keep the semantic source explicit at the call site rather than inferring it from the group number.
        if (source !== "scene" && source !== "node") return;
        pipeline.setBindgroup(group, binding);
    }

    private rebuildPipelines(primitives: readonly PrimitiveAdaptor[]): void {
        const frame = this.internal.getFrame();
        const scene = this.internal.getSceneBindgroup();
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
                .map(([, attribute]) => attribute.getLayout());

            // Reuse by index so a material tweak that keeps the variant count keeps the same representations.
            const pipelines = this.internal.getPipelines().get(primitive.uuid) ?? [];
            while (pipelines.length < settings.cullModes.length) pipelines.push(new PipelineInteractor());
            pipelines.length = settings.cullModes.length;

            settings.cullModes.forEach((cullMode, i) => {
                const pipeline = pipelines[i];
                pipeline.setVertex(primitive.getVertex());
                pipeline.setFragment(primitive.getFragment());
                pipeline.setVertexBuffers(buffers);
                pipeline.setPrimitiveState({topology: "triangle-list", cullMode});
                pipeline.setMaterialState({blend: settings.blend, depthWriteEnabled: settings.depthWriteEnabled});
                if (frame) pipeline.setFrame(frame);
                if (scene) this.setBindingGroup(pipeline, "scene", 0, scene);
                pipeline.setBindgroup(material.getGroup(), material.getBindgroupInteractor());
                this.setBindingGroup(pipeline, "node", this.internal.group, this.internal.bindgroupInteractor);
            });

            this.internal.setPipelines(primitive.uuid, pipelines);
        }

        for (const uuid of Array.from(this.internal.getPipelines().keys())) {
            if (!live.has(uuid)) this.internal.removePipelines(uuid);
        }
    }
}
