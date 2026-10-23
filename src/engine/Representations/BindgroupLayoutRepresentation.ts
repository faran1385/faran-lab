import {v4 as uuidv4} from "uuid";
import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";
import {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import {BindgroupLayoutRepresentationHashProvider} from "../hashing/BindgroupLayoutRepresentationHashProvider.ts";
import {BufferInternal} from "../internals/BufferInternal.ts";


type LayoutBinding = LayoutTextureEntry | LayoutSamplerEntry | LayoutBufferEntry

export type BindgroupLayoutEntry<T extends LayoutBinding> =
    {
        binding: number,
        visibility: GPUShaderStageFlags,
    }
    & T

export type LayoutBufferEntry = {
    buffer: BufferInternal
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
    readonly hashProvider: BindgroupLayoutRepresentationHashProvider;

    constructor() {
        this.uuid = uuidv4();
        this.hashProvider = new BindgroupLayoutRepresentationHashProvider({getEntries: () => this.entries});
    }

    getEntries() {
        return this.entries.values()
    }

    getEntry(binding: number): BindgroupLayoutEntry<LayoutBinding> | undefined {
        return this.entries.get(binding);
    }

    setEntry(binding: number, entry: BindgroupLayoutEntry<LayoutBinding>) {
        this.entries.set(binding, entry)
        this.hashProvider.markChanged()
    }

    removeEntry(binding: number) {
        this.entries.delete(binding)
        this.hashProvider.markChanged()
    }
}