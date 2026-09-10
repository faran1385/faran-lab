import type {AlphaMode, PipelineWrapper} from "../wrappers/PipelineWrapper.ts";
import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";

export class PipelineDescriptorProducer {
    private static blendStateFor(alphaMode: AlphaMode): GPUBlendState | undefined {
        if (alphaMode !== "BLEND") return undefined;
        return {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
        };
    }

    static produce(
        pipeline: PipelineWrapper,
        primitive: PrimitiveWrapper,
        layout: GPUPipelineLayout,
        vertexModule: GPUShaderModule,
        fragmentModule: GPUShaderModule,
    ): GPURenderPipelineDescriptor {
        return {
            layout,
            vertex: {
                module: vertexModule,
                entryPoint: primitive.getPipeline().getVertexShaderWrapper().getEntryPoint(),
                buffers: this.buildVertexBufferLayouts(primitive), // pending — needs PrimitiveWrapper shape
            },
            fragment: {
                module: fragmentModule,
                entryPoint: primitive.getPipeline().getFragmentShaderWrapper().getEntryPoint(),
                targets: [
                    {
                        format: pipeline.getTargetFormat(),
                        blend: this.blendStateFor(pipeline.getAlphaMode()),
                    },
                ],
            },
            primitive: {
                topology: pipeline.getTopology(),
                cullMode: pipeline.getDoubleSided() ? "none" : "back",
            },
            multisample: {
                count: pipeline.getSampleCount(),
            },
        };
    }

    private static buildVertexBufferLayouts(primitive: PrimitiveWrapper): GPUVertexBufferLayout[] {
        const geometry = primitive.getGeometry();
        const layoutDescriptor = geometry.getLayoutDescriptor();

        const layouts: GPUVertexBufferLayout[] = [];

        for (const [, attribute] of layoutDescriptor) {
            layouts.push({
                arrayStride: attribute.arrayStride,
                stepMode: "vertex",
                attributes: [
                    {
                        shaderLocation: attribute.shaderLocation,
                        format: attribute.format,
                        offset: 0,
                    },
                ],
            });
        }

        return layouts;
    }
}