import type {PipelineVariant, PipelineWrapper} from "../wrappers/PipelineWrapper.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {HashData} from "../hashing/utils/HashData.ts";
import type {ShaderModuleManager} from "../managers/ShaderModuleManager.ts";
import type {PipelineLayoutManager} from "../managers/PipelineLayoutManager.ts";
import type {GeometryAttributePlan} from "./utils.ts";

export interface FrameTargetInfo {
    colorFormat: GPUTextureFormat;
    depthFormat: GPUTextureFormat;
}

export interface PipelineProduceArgs {
    pipeline: PipelineWrapper;
    /** Which variant to build. This is the only thing that differs between a primitive's pipelines. */
    cullMode: PipelineVariant;
    material: MaterialWrapper;
    geometry: GeometryWrapper;
    hashes: HashData;
    frame: FrameTargetInfo;
    shaderModules: ShaderModuleManager;
    pipelineLayouts: PipelineLayoutManager;
}

export class PipelineProducer {
    static produce(
        {pipeline, cullMode, material, hashes, frame, shaderModules, pipelineLayouts}: PipelineProduceArgs,
        getAttributePlan: () => GeometryAttributePlan,
    ): GPURenderPipelineDescriptor {
        const vs = pipeline.getVertexShaderWrapper();
        const fs = pipeline.getFragmentShaderWrapper();
        const plan = getAttributePlan();
        const isBlend = material.getAlphaMode() === "blend";

        const buffers: GPUVertexBufferLayout[] = plan.slots.map((s) => ({
            arrayStride: s.arrayStride,
            stepMode: "vertex",
            attributes: [{shaderLocation: s.shaderLocation, offset: 0, format: s.format}],
        }));

        return {
            label: pipeline.uuid,
            layout: pipelineLayouts.getRaw(hashes.material.layout),
            vertex: {
                module: shaderModules.getRaw(hashes.pipeline.vertexShader),
                entryPoint: vs.getEntryPoint(),
                buffers,
            },
            fragment: {
                module: shaderModules.getRaw(hashes.pipeline.fragmentShader),
                entryPoint: fs.getEntryPoint(),
                targets: [{
                    format: frame.colorFormat,
                    blend: isBlend
                        ? {
                            color: {srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add"},
                            alpha: {srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add"},
                        }
                        : undefined,
                }],
            },
            primitive: {
                topology: "triangle-list",
                cullMode,
            },
            depthStencil: {
                format: frame.depthFormat,
                depthWriteEnabled: !isBlend,
                depthCompare: "less",
            },
        };
    }
}