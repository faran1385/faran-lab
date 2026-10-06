import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {HashData, GeometryHashes, MaterialHashes, PipelineHashes} from "../hashing/utils/HashData.ts";
import type {RenderContext} from "./RenderContext.ts";
import type {NodeWrapper} from "../wrappers/NodeWrapper.ts";

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

    static node(node: NodeWrapper, ctx: RenderContext) {
        const nodeMesh = node.getMesh();
        if (nodeMesh && nodeMesh.getPrimitivesCount() > 0) {
            ctx.managers.bufferManager.ensure(node.uuid, () => ctx.producer.produceBufferFromNodeMatrix(node));
            ctx.managers.bindgroupManager.ensure(node.uuid, () => ctx.producer.produceBindgroupFromNode({
                layouts: ctx.managers.bindgroupLayoutManager,
                buffers: ctx.managers.bufferManager,
                node
            }));
        }
    }

    static material(material: MaterialWrapper, hashes: MaterialHashes, ctx: RenderContext): void {
        const {managers, producer} = ctx;

        managers.bufferManager.ensure(hashes.factors, () => producer.produceBufferFromMatFactors(material));

        for (const component of material.getSortedComponents()) {
            const slot = component.getTexture();
            if (!slot) continue;

            const texture = hashes.textures.get(component.name)!;
            managers.samplerManager.ensure(texture.sampler, () => producer.produceSampler(slot.wrapper.getSampler()));
            managers.textureManager.ensure(texture.image, () => producer.produceTexture(slot.wrapper.getImage()));
        }

        managers.bindgroupLayoutManager.ensure(hashes.layout, () => producer.produceBindGroupLayout(material));
        managers.bindgroupManager.ensure(hashes.bindgroup, () => producer.produceBindGroup({
            material,
            hashes,
            buffers: managers.bufferManager,
            layouts: managers.bindgroupLayoutManager,
            textures: managers.textureManager,
            samplers: managers.samplerManager,
        }));
        managers.pipelineLayoutManager.ensure(hashes.layout, () => producer.producePipelineLayout({
            material, hashes, layouts: managers.bindgroupLayoutManager
        }));
    }

    static shaders(p: PrimitiveWrapper, hashes: PipelineHashes, ctx: RenderContext): void {
        const {managers, producer} = ctx;
        const pipeline = p.getPipeline();

        const vWrapper = pipeline.getVertexShaderWrapper();
        managers.shaderModuleManager.ensure(hashes.vertexShader, () => producer.produceShaderModule(vWrapper));

        const fWrapper = pipeline.getFragmentShaderWrapper();
        managers.shaderModuleManager.ensure(hashes.fragmentShader, () => producer.produceShaderModule(fWrapper));
    }

    static pipeline(p: PrimitiveWrapper, data: HashData, ctx: RenderContext): void {
        const {managers, producer, frame} = ctx;

        for (const [cullMode, hash] of data.pipeline.pipelines) {
            managers.pipelineManager.ensure(hash, () => producer.producePipeline({
                cullMode,
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
}
