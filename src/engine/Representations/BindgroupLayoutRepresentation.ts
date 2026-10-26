import {v4 as uuidv4} from "uuid";
import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";
import {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import {BindgroupLayoutRepresentationHashProvider} from "../hashing/BindgroupLayoutRepresentationHashProvider.ts";
import {BufferInternal} from "../internals/BufferInternal.ts";
import {bufferBindingTypeOf} from "./bindingTypes.ts";


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
    private locked = false;

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

    /** One way: there is no unlock. A locked layout throws on every change (see BindgroupInteractor.lock). */
    lock(): void {
        this.locked = true;
    }

    setEntry(binding: number, entry: BindgroupLayoutEntry<LayoutBinding>) {
        this.assertUnlocked("setEntry");
        const previous = this.entries.get(binding);
        const previousShape = previous ? this.entryShape(previous) : undefined;
        const nextShape = this.entryShape(entry);
        this.entries.set(binding, entry);

        // Keep the latest resource reference for child-stamp tracking, but don't invalidate a layout whose structure
        // (resource kind, texture sample format, and visibility) is unchanged.
        if (previousShape !== nextShape) this.hashProvider.markChanged();
    }

    private entryShape(entry: BindgroupLayoutEntry<LayoutBinding>): string {
        if ("buffer" in entry) return `buffer:${entry.visibility}:${bufferBindingTypeOf(entry.buffer)}`;
        if ("sampler" in entry) return `sampler:${entry.visibility}`;
        return `texture:${entry.visibility}:${entry.texture.getFormat()}`;
    }

    removeEntry(binding: number) {
        this.assertUnlocked("removeEntry");
        this.entries.delete(binding)
        this.hashProvider.markChanged()
    }

    private assertUnlocked(method: string): void {
        if (this.locked) throw new Error(`BindgroupLayoutRepresentation.${method}: this layout is locked, its entries can no longer change`);
    }
}