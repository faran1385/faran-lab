import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {HashData, GeometryHashes, MaterialHashes, PipelineHashes} from "../hashing/HashData.ts";
import type {GeneratedStages} from "./ShaderCodeLayer.ts";
import type {RenderContext} from "./RenderContext.ts";

/**
 * The resource layer: ensures GPU resources exist. Every method here is called only for hashes that were actually
 * computed, so a primitive that merely read cached hashes never reaches it. It reads hashes, it never computes them.
 */
export class ResourceLayer {
    static geometry(geometry: GeometryWrapper, hashes: GeometryHashes, ctx: RenderContext): void {
        const {managers, producer} = ctx;

        for (const attribute of geometry.getAttributes().values()) {
            managers.bufferManager.ensure(hashes.attributeBuffers.get(attribute.name)!, () => producer.produceBuffer(attribute));
        }

        const indices = geometry.getIndices();
        if (indices) {
            managers.bufferManager.ensure(hashes.indices!, () => producer.produceBuffer(indices));
        }
    }

    static material(material: MaterialWrapper, hashes: MaterialHashes, ctx: RenderContext): void {
        const {managers, producer} = ctx;

        managers.bufferManager.ensure(hashes.factors, () => producer.produceBufferFromMatFactors(material));

        for (const component of material.getAllComponents()) {
            const slot = component.getTexture();
            if (!slot) continue;

            const texture = hashes.textures.get(component.name)!;
            managers.samplerManager.ensure(texture.sampler, () => producer.produceSampler(slot.wrapper.getSampler()));
            managers.textureManager.ensure(texture.image, () => producer.produceTexture(slot.wrapper.getImage()));
        }

        managers.bindgroupLayoutManager.ensure(hashes.layout, () => producer.produceBindGroupLayout(material));
        managers.bindgroupManager.ensure(hashes.bindgroup, () => producer.produceBindGroup({
            material, hashes, buffers: managers.bufferManager,
            layouts: managers.bindgroupLayoutManager, textures: managers.textureManager, samplers: managers.samplerManager,
        }));
        managers.pipelineLayoutManager.ensure(hashes.layout, () => producer.producePipelineLayout({
            material, hashes, layouts: managers.bindgroupLayoutManager
        }));
    }

    /** Only the stages whose code was just regenerated can have a new module. */
    static shaders(p: PrimitiveWrapper, hashes: PipelineHashes, generated: GeneratedStages, ctx: RenderContext): void {
        const {managers, producer} = ctx;
        const pipeline = p.getPipeline();

        if (generated.vertex) {
            const wrapper = pipeline.getVertexShaderWrapper();
            managers.shaderModuleManager.ensure(hashes.vertexShader, () => producer.produceShaderModule(wrapper));
        }
        if (generated.fragment) {
            const wrapper = pipeline.getFragmentShaderWrapper();
            managers.shaderModuleManager.ensure(hashes.fragmentShader, () => producer.produceShaderModule(wrapper));
        }
    }

    static pipeline(p: PrimitiveWrapper, data: HashData, ctx: RenderContext): void {
        const {managers, producer, frame} = ctx;

        managers.pipelineManager.ensure(data.pipeline.pipeline, () => producer.producePipeline({
            frame: {colorFormat: frame.colorFormat, depthFormat: frame.depthFormat},
            hashes: data,
            geometry: p.getGeometry(),
            material: p.getMaterial(),
            pipelineLayouts: managers.pipelineLayoutManager,
            pipeline: p.getPipeline(),
            shaderModules: managers.shaderModuleManager
        }));
    }
}
