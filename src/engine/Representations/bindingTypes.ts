/**
 * How a bind group layout entry's resource maps onto a GPU binding type. Shared by the layout hash (which must tell
 * two different binding types apart) and by the layout producer (which writes them into the descriptor).
 * Type-only imports, so the hash provider and the representation can both use it without an import cycle.
 */
import type {BufferInternal} from "../internals/BufferInternal.ts";

export function bufferBindingTypeOf(buffer: BufferInternal): GPUBufferBindingType {
    const usage = buffer.getUsage();
    if (usage & GPUBufferUsage.UNIFORM) return "uniform";
    if (usage & GPUBufferUsage.STORAGE) return "read-only-storage";
    throw new Error("bufferBindingTypeOf: a bound buffer needs UNIFORM or STORAGE usage");
}

const UNFILTERABLE = new Set<GPUTextureFormat>(["r32float", "rg32float", "rgba32float"]);

export function textureSampleTypeOf(format: GPUTextureFormat): GPUTextureSampleType {
    return UNFILTERABLE.has(format) ? "unfilterable-float" : "float";
}
