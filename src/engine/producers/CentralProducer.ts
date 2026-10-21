import type {BufferInternal} from "../internals/BufferInternal.ts";
import {type BufferDescriptor, BufferProducer} from "./BufferProducer.ts";
import {BindGroupLayoutProducer} from "./BindGroupLayoutProducer.ts";
import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import {type TextureDescriptor, TextureProducer, type TextureUpdateDescriptor} from "./TextureDescriptorProducer.ts";
import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";
import {SamplerProducer} from "./SamplerProducer.ts";
import {ShaderModuleProducer} from "./ShaderProducer.ts";
import {type BindGroupProduceArgs, BindGroupProducer} from "./BindGroupProducer.ts";
import {type PipelineLayoutProduceArgs, PipelineLayoutProducer} from "./PipelineLayoutProducer.ts";
import {type PipelineProduceArgs, PipelineProducer} from "./PipelineProducer.ts";
import type {BindgroupLayoutRepresentation} from "../Representations/BindgroupLayoutRepresentation.ts";

/**
 * One entry point for every descriptor the managers need. Stateless: the plans that used to be cached here (binding,
 * factors, attributes) are computed by the adapters, before the frame, and live on the internals.
 */
export class CentralProducer {
    produceBuffer(buffer: BufferInternal): BufferDescriptor {
        return BufferProducer.produce(buffer);
    }

    produceTexture(image: ImageWrapper): TextureDescriptor {
        return TextureProducer.produce(image);
    }

    produceTextureUpdate(image: ImageWrapper): TextureUpdateDescriptor {
        return TextureProducer.produceUpdate(image);
    }

    produceSampler(sampler: SamplerWrapper): GPUSamplerDescriptor {
        return SamplerProducer.produce(sampler);
    }

    produceShaderModule(code: string, label: string): GPUShaderModuleDescriptor {
        return ShaderModuleProducer.produce(code, label);
    }

    produceBindGroupLayout(layout: BindgroupLayoutRepresentation, label: string): GPUBindGroupLayoutDescriptor {
        return BindGroupLayoutProducer.produce(layout, label);
    }

    produceBindGroup(args: BindGroupProduceArgs): GPUBindGroupDescriptor {
        return BindGroupProducer.produce(args);
    }

    producePipelineLayout(args: PipelineLayoutProduceArgs): GPUPipelineLayoutDescriptor {
        return PipelineLayoutProducer.produce(args);
    }

    producePipeline(args: PipelineProduceArgs): GPURenderPipelineDescriptor {
        return PipelineProducer.produce(args);
    }
}
