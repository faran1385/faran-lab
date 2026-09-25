import type {PipelineWrapper} from "../wrappers/PipelineWrapper.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {Hasher} from "../hashing/Hasher.ts";
import type {ShaderModuleManager} from "../managers/ShaderModuleManager.ts";
import type {PipelineLayoutManager} from "../managers/PipelineLayoutManager.ts";
import type {GeometryAttributePlan} from "./utils.ts";

export interface FrameTargetInfo {
    colorFormat: GPUTextureFormat;
    depthFormat: GPUTextureFormat;
}

export interface PipelineProduceArgs {
    pipeline: PipelineWrapper;
    material: MaterialWrapper;
    geometry: GeometryWrapper;
    hasher: Hasher;
    frame: FrameTargetInfo;
    shaderModules: ShaderModuleManager;
    pipelineLayouts: PipelineLayoutManager;
}

export class PipelineProducer {
    static produce(
        { pipeline, material, hasher, frame, shaderModules, pipelineLayouts }: PipelineProduceArgs,
        getAttributePlan: () => GeometryAttributePlan,
    ): GPURenderPipelineDescriptor {
        const vs = pipeline.getVertexShaderWrapper();
        const fs = pipeline.getFragmentShaderWrapper();
        const plan = getAttributePlan();
        const isBlend = material.getAlphaMode() === "blend";

        const buffers: GPUVertexBufferLayout[] = plan.slots.map((s) => ({
            arrayStride: s.arrayStride,
            stepMode: "vertex",
            attributes: [{ shaderLocation: s.shaderLocation, offset: 0, format: s.format }],
        }));

        return {
            label: pipeline.uuid,
            layout: pipelineLayouts.getRaw(material.convertToBindgroupLayoutHash(hasher)),
            vertex: {
                module: shaderModules.getRaw(vs.convertToHash(hasher)),
                entryPoint: vs.getEntryPoint(),
                buffers,
            },
            fragment: {
                module: shaderModules.getRaw(fs.convertToHash(hasher)),
                entryPoint: fs.getEntryPoint(),
                targets: [{
                    format: frame.colorFormat,
                    blend: isBlend
                        ? {
                            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
                        }
                        : undefined,
                }],
            },
            primitive: {
                topology: "triangle-list",
                cullMode: PipelineProducer.cullMode(material, pipeline.getFacePass()),
            },
            depthStencil: {
                format: frame.depthFormat,
                depthWriteEnabled: !isBlend,
                depthCompare: "less",
            },
        };
    }

    private static cullMode(material: MaterialWrapper, facePass: "single" | "back" | "front"): GPUCullMode {
        if (!material.getDoubleSided()) return "back";
        if (facePass === "back") return "front";  // this variant draws back faces only
        if (facePass === "front") return "back";  // this variant draws front faces only
        return "none";
    }
}