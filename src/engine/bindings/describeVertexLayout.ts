import type {VertexBufferEntry} from "./VertexLayoutSet.ts";

/**
 * Pure functions that turn vertex buffer entries into what the rest of the engine needs: the GPU layout and the cache
 * keys. Nothing here touches the GPU or any manager.
 */

/** The GPU layout, one element per slot. Entries must already be complete and in slot order. */
export function toGpuVertexBufferLayouts(buffers: readonly VertexBufferEntry[]): GPUVertexBufferLayout[] {
    return buffers.map((b): GPUVertexBufferLayout => ({
        arrayStride: b.arrayStride,
        stepMode: b.stepMode,
        attributes: b.attributes.map((a) => ({shaderLocation: a.location, offset: a.offset, format: a.format})),
    }));
}

/**
 * The cache key of the GPU layout: strides, step modes and every attribute's location, format and offset, in slot
 * order. Names and buffers are not in it (the GPU does not see them), so two geometries with the same layout and
 * different data share it.
 */
export function vertexLayoutKeyOf(buffers: readonly VertexBufferEntry[]): string {
    return buffers
        .map((b) => `${b.arrayStride}/${b.stepMode}/` + b.attributes.map((a) => `${a.location}:${a.format}@${a.offset}`).join(","))
        .join("|");
}

/**
 * The key of what generated vertex code depends on: which names sit at which location with which WGSL type. This is
 * different from the layout key on purpose. Renaming an attribute changes the code but not the GPU layout, and
 * moving an attribute to another offset changes the layout but not the code.
 */
export function shaderInputsKeyOf(buffers: readonly VertexBufferEntry[]): string {
    return buffers
        .flatMap((b) => b.attributes)
        .sort((a, b) => a.location - b.location)
        .map((a) => `${a.location}:${a.name}:${a.wgslType}`)
        .join("|");
}
