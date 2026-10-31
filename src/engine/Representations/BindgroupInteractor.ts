import {BindgroupRepresentation} from "./BindgroupRepresentation.ts";
import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import type {BufferInternal} from "../internals/BufferInternal.ts";
import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";

/** One binding, in the form the constructor takes it. */
export type BindgroupInteractorEntry =
    | { type: "uniform", binding: number, resource: BufferInternal, visibility: GPUShaderStageFlags }
    | { type: "texture", binding: number, resource: ImageWrapper, visibility: GPUShaderStageFlags }
    | { type: "sampler", binding: number, resource: SamplerWrapper, visibility: GPUShaderStageFlags };

export interface BindgroupInteractorOptions {
    /** Bindings set before the interactor is handed out. */
    entries?: readonly BindgroupInteractorEntry[];
    /**
     * A locked interactor throws on every change (its layout too), for good: that is what makes it safe to share one
     * interactor between many consumers. Default false. `lock()` does the same later.
     */
    isLocked?: boolean;
}

export class BindgroupInteractor extends BindgroupRepresentation {
    private locked = false;

    constructor(options: BindgroupInteractorOptions = {}) {
        super();
        for (const entry of options.entries ?? []) {
            switch (entry.type) {
                case "uniform":
                    this.setUniform(entry.binding, entry.resource, entry.visibility);
                    break;
                case "texture":
                    this.setTexture(entry.binding, entry.resource, entry.visibility);
                    break;
                case "sampler":
                    this.setSampler(entry.binding, entry.resource, entry.visibility);
                    break;
            }
        }
        if (options.isLocked) this.lock();
    }

    get isLocked(): boolean {
        return this.locked;
    }

    /** One way: there is no unlock. The layout is locked with it, so it cannot be changed from `layout` either. */
    lock(): void {
        this.locked = true;
        this.layout.lock();
    }

    setTexture(binding: number, resource: ImageWrapper, visibility: GPUShaderStageFlags) {
        this.assertUnlocked("setTexture");
        if (this.getEntry(binding)?.resource !== resource) {
            this.setEntry(binding, {binding, resource});
        }

        this.layout.setEntry(binding, {binding, texture: resource, visibility});
    }

    setUniform(binding: number, resource: BufferInternal, visibility: GPUShaderStageFlags) {
        this.assertUnlocked("setUniform");
        if (this.getEntry(binding)?.resource !== resource) {
            this.setEntry(binding, {binding, resource});
        }

        this.layout.setEntry(binding, {binding, buffer: resource, visibility});
    }

    /**
     * Binds a STORAGE buffer (read-only in shaders). The binding type comes from the buffer's usage flags, exactly as
     * for setUniform; this only checks that the buffer really is a storage buffer.
     */
    setStorage(binding: number, resource: BufferInternal, visibility: GPUShaderStageFlags) {
        if (!(resource.getUsage() & GPUBufferUsage.STORAGE)) {
            throw new Error("BindgroupInteractor.setStorage: the buffer needs STORAGE usage");
        }
        this.setUniform(binding, resource, visibility);
    }

    /** Removes the entry and its layout entry together, so the two never disagree. */
    removeBinding(binding: number) {
        this.assertUnlocked("removeBinding");
        this.removeEntry(binding);
        this.layout.removeEntry(binding);
    }

    setSampler(binding: number, resource: SamplerWrapper, visibility: GPUShaderStageFlags) {
        this.assertUnlocked("setSampler");
        if (this.getEntry(binding)?.resource !== resource) {
            this.setEntry(binding, {binding, resource});
        }

        this.layout.setEntry(binding, {binding, sampler: resource, visibility});
    }

    private assertUnlocked(method: string): void {
        if (this.locked) throw new Error(`BindgroupInteractor.${method}: this interactor is locked, its bindings can no longer change`);
    }
}
