import {v4 as uuidv4} from "uuid";
import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";
import {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import {BufferWrapper} from "../wrappers/BufferWrapper.ts";


type LayoutBinding = LayoutTextureEntry | LayoutSamplerEntry | LayoutBufferEntry

export type BindgroupLayoutEntry<T extends LayoutBinding> =
    {
        binding: number,
        visibility: GPUShaderStageFlags,
    }
    & T

export type LayoutBufferEntry = {
    buffer: BufferWrapper
}

export type LayoutSamplerEntry = {
    sampler: SamplerWrapper
}
export type LayoutTextureEntry = {
    texture: ImageWrapper
}


export class BindgroupLayoutRepresentation {
    readonly uuid: string;
    private entries = new Map<number, BindgroupLayoutEntry<LayoutBinding>>()

    constructor() {
        this.uuid = uuidv4();
    }

    setEntry(binding: number, entry: BindgroupLayoutEntry<LayoutBinding>) {
        this.entries.set(binding, entry)
    }

    removeEntry(binding: number) {
        this.entries.delete(binding)
    }
}