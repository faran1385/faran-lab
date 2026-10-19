import {BindgroupRepresentation} from "./BindgroupRepresentation.ts";
import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import type {BufferWrapper} from "../wrappers/BufferWrapper.ts";
import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";


export class BindgroupInteractor {
    readonly bindgroup = new BindgroupRepresentation();

    setTexture(binding: number, resource: ImageWrapper, visibility: GPUShaderStageFlags) {
        this.bindgroup.setEntry(binding, {
            binding,
            resource,
        })

        this.bindgroup.getLayout().setEntry(binding, {
            binding: binding,
            texture: resource,
            visibility
        })
    }

    setUniform(binding: number, resource: BufferWrapper, visibility: GPUShaderStageFlags) {
        this.bindgroup.setEntry(binding, {
            binding,
            resource,
        })

        this.bindgroup.getLayout().setEntry(binding, {
            binding: binding,
            buffer: resource,
            visibility
        })
    }

    setSampler(binding: number, resource: SamplerWrapper, visibility: GPUShaderStageFlags) {
        this.bindgroup.setEntry(binding, {
            binding,
            resource,
        })

        this.bindgroup.getLayout().setEntry(binding, {
            binding: binding,
            sampler: resource,
            visibility
        })
    }
}