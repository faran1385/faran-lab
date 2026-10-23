import {BindgroupRepresentation} from "./BindgroupRepresentation.ts";
import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import type {BufferInternal} from "../internals/BufferInternal.ts";
import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";

export class BindgroupInteractor extends BindgroupRepresentation {
    constructor() {
        super();
    }

    setTexture(binding: number, resource: ImageWrapper, visibility: GPUShaderStageFlags) {
        if (this.getEntry(binding)?.resource !== resource) {
            this.setEntry(binding, {binding, resource});
        }

        this.layout.setEntry(binding, {binding, texture: resource, visibility});
    }

    setUniform(binding: number, resource: BufferInternal, visibility: GPUShaderStageFlags) {
        if (this.getEntry(binding)?.resource !== resource) {
            this.setEntry(binding, {binding, resource});
        }

        this.layout.setEntry(binding, {binding, buffer: resource, visibility});
    }

    /** Removes the entry and its layout entry together, so the two never disagree. */
    removeBinding(binding: number) {
        this.removeEntry(binding);
        this.layout.removeEntry(binding);
    }

    setSampler(binding: number, resource: SamplerWrapper, visibility: GPUShaderStageFlags) {
        if (this.getEntry(binding)?.resource !== resource) {
            this.setEntry(binding, {binding, resource});
        }

        this.layout.setEntry(binding, {binding, sampler: resource, visibility});
    }
}
