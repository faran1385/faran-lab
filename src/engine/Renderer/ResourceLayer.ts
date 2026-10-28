import {BufferInternal} from "../internals/BufferInternal.ts";
import {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import type {GeometryInternal} from "../internals/GeometryInternal.ts";
import type {BindgroupRepresentation} from "../Representations/BindgroupRepresentation.ts";
import type {BindgroupLayoutRepresentation} from "../Representations/BindgroupLayoutRepresentation.ts";
import type {RenderContext} from "./RenderContext.ts";
import type {HeldKeys} from "./HeldKeys.ts";
import type {PipelineRepresentation} from "../Representations/PipelineRepresentation.ts";

/**
 * The resource layer: makes sure the GPU resources behind a representation exist, and records every key it touched in
 * `held` so the caller can acquire them. Keys are the representations' own content hashes (identity for buffers), so
 * two nodes that describe the same thing share one GPU object. Ensuring a key that exists is a map lookup.
 *
 * It reads representations and internals only. It never builds a descriptor itself: that is the producers' job.
 */
export class ResourceLayer {
    /** Buffers are keyed by identity: their contents change in place and are uploaded, not re-hashed. */
    static buffer(buffer: BufferInternal, ctx: RenderContext, held: HeldKeys): string {
        const key = buffer.hashProvider.convertToHash();
        ctx.managers.bufferManager.ensure(key, () => ctx.producer.produceBuffer(buffer));
        held.buffers.add(key);
        return key;
    }

    static bindgroupLayout(layout: BindgroupLayoutRepresentation, ctx: RenderContext, held: HeldKeys): string {
        const key = layout.hashProvider.convertToHash(ctx.hasher);
        ctx.managers.bindgroupLayoutManager.ensure(key, () => ctx.producer.produceBindGroupLayout(layout, layout.uuid));
        held.bindgroupLayouts.add(key);
        return key;
    }

    /** Ensures everything the bind group binds, its layout, and the bind group itself. */
    static bindgroup(bindgroup: BindgroupRepresentation, ctx: RenderContext, held: HeldKeys): string {
        const {managers, producer, hasher} = ctx;

        for (const entry of bindgroup.getEntries()) {
            const resource = entry.resource;
            if (resource instanceof BufferInternal) {
                ResourceLayer.buffer(resource, ctx, held);
            } else if (resource instanceof ImageWrapper) {
                const key = resource.hashProvider.convertToHash(hasher);
                managers.textureManager.ensure(key, () => producer.produceTexture(resource));
                held.textures.add(key);
            } else {
                const key = resource.hashProvider.convertToHash(hasher);
                managers.samplerManager.ensure(key, () => producer.produceSampler(resource));
                held.samplers.add(key);
            }
        }

        const layoutKey = ResourceLayer.bindgroupLayout(bindgroup.layout, ctx, held);
        const key = bindgroup.hashProvider.convertToHash(hasher);
        managers.bindgroupManager.ensure(key, () => producer.produceBindGroup({
            bindgroup, layoutKey, hasher, managers, label: bindgroup.uuid,
        }));
        held.bindgroups.add(key);
        return key;
    }

    /** The vertex buffers and, when the draw is indexed, the index buffer. */
    static geometry(geometry: GeometryInternal, ctx: RenderContext, held: HeldKeys): void {
        for (const attribute of geometry.getVertexAttributes().values()) {
            ResourceLayer.buffer(attribute, ctx, held);
        }
        const draw = geometry.getDrawInfo();
        if ("indexBuffer" in draw) ResourceLayer.buffer(draw.indexBuffer, ctx, held);
    }

    /**
     * Layouts, shader modules and the pipeline. Returns the pipeline's key, or null when the representation is not
     * complete yet (no code, no frame formats): such a pipeline is simply not drawn until it is.
     */
    static pipeline(pipeline: PipelineRepresentation, ctx: RenderContext, held: HeldKeys): string | null {
        const {managers, producer, hasher} = ctx;

        const vertex = pipeline.getVertexShader();
        const fragment = pipeline.getFragmentShader();

        if (!vertex.code || !fragment.code
            || !pipeline.getPrimitive() || !pipeline.getDepthStencil()
            || pipeline.getFragmentTargets().size === 0) return null;
        for (const bindgroup of pipeline.bindgroups.values()) {
            ResourceLayer.bindgroupLayout(bindgroup.layout, ctx, held);
        }

        const layout = pipeline.getLayout();
        const layoutKey = layout.hashProvider.convertToHash(hasher);
        managers.pipelineLayoutManager.ensure(layoutKey, () => producer.producePipelineLayout({
            layout, hasher, managers, label: layout.uuid,
        }));
        held.pipelineLayouts.add(layoutKey);

        // A module is identified by its code alone; the entry point belongs to the pipeline.
        const vertexModuleKey = hasher.hashString(vertex.code);
        managers.shaderModuleManager.ensure(vertexModuleKey, () => producer.produceShaderModule(vertex.code, `${pipeline.uuid} vertex`));
        const fragmentModuleKey = hasher.hashString(fragment.code);
        managers.shaderModuleManager.ensure(fragmentModuleKey, () => producer.produceShaderModule(fragment.code, `${pipeline.uuid} fragment`));
        held.shaderModules.add(vertexModuleKey);
        held.shaderModules.add(fragmentModuleKey);

        const key = pipeline.hashProvider.convertToHash(hasher);
        managers.pipelineManager.ensure(key, () => producer.producePipeline({
            pipeline, label: pipeline.uuid, layoutKey, vertexModuleKey, fragmentModuleKey, managers,
        }));
        held.pipelines.add(key);
        return key;
    }
}
