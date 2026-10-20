import {BindgroupRepresentation} from "./BindgroupRepresentation.ts";
import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import type {BufferInternal} from "../internals/BufferInternal.ts";
import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";


export class BindgroupInteractor extends BindgroupRepresentation{

    constructor() {
        super();
    }

    setTexture(binding: number, resource: ImageWrapper, visibility: GPUShaderStageFlags) {
        this.setEntry(binding, {
            binding,
            resource,
        })

        this.layout.setEntry(binding, {
            binding: binding,
            texture: resource,
            visibility
        })
    }

    setUniform(binding: number, resource: BufferInternal, visibility: GPUShaderStageFlags) {
        this.setEntry(binding, {
            binding,
            resource,
        })

        this.layout.setEntry(binding, {
            binding: binding,
            buffer: resource,
            visibility
        })
    }

    setSampler(binding: number, resource: SamplerWrapper, visibility: GPUShaderStageFlags) {
        this.setEntry(binding, {
            binding,
            resource,
        })

        this.layout.setEntry(binding, {
            binding: binding,
            sampler: resource,
            visibility
        })
    }
}