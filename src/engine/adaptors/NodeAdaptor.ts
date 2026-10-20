import {NodeInternal} from "../internals/NodeInternal.ts";
import {BufferInternal} from "../internals/BufferInternal.ts";
import {PipelineInteractor} from "../Representations/PipelineInteractor.ts";
import {mat4} from "../../packages/math/matrix/mat4.ts";
import {schedulePreFrame} from "./PreFrameQueue.ts";
import type {MeshWrapper} from "../wrappers/MeshWrapper.ts";
import type {MeshAdaptor} from "./MeshAdaptor.ts";
import type {PrimitiveAdaptor} from "./PrimitiveAdaptor.ts";


/**
 * Translates a node: links its mesh internal and builds, for every primitive of that mesh, the pipeline
 * representations the render side will create GPU pipelines from (stored on the NodeInternal, keyed by primitive uuid).
 *
 * It listens to its mesh (primitives added/removed) and to each primitive (material, geometry, stage code). Frame
 * formats and the group 0 bind group are render-side inputs: they live on the NodeInternal (setFrame /
 * setSceneBindgroup) and this adapter only applies what is stored there to the pipelines it builds.
 */
export class NodeAdaptor {
    readonly internal: NodeInternal;
    readonly buffer = new BufferInternal(mat4.create().buffer, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

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
    }

    setMesh(mesh: MeshWrapper | null) {
        this.mesh?.changed.unsubscribe(this.internal.uuid);
        this.mesh = mesh?.adaptor ?? null;
        this.mesh?.changed.subscribe(this.internal.uuid, this.onDependencyChange);
        this.internal.setMesh(this.mesh?.internal ?? null);
        this.invalidate();
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

            const settings = material.getPipelineSettings();
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
                if (scene) pipeline.setBindgroup(0, scene);
                pipeline.setBindgroup(1, material.getBindgroupInteractor());
                pipeline.setBindgroup(2, this.internal.bindgroupInteractor);
            });

            this.internal.setPipelines(primitive.uuid, pipelines);
        }

        for (const uuid of Array.from(this.internal.getPipelines().keys())) {
            if (!live.has(uuid)) this.internal.removePipelines(uuid);
        }
    }
}
