import {BufferInternal} from "./BufferInternal.ts";

/**
 * What the render side knows about a geometry's morph targets: the packed deltas (a storage buffer, never re-created, only
 * edited in place and uploaded) and the small header that describes their layout to the shader. The geometry adapter
 * binds both in the geometry's bind group, so every node drawing the geometry shares them.
 */
export class MorphTargetInternal {
    readonly deltas: BufferInternal;
    readonly header: BufferInternal;

    constructor(deltas: ArrayBuffer, header: ArrayBuffer) {
        this.deltas = new BufferInternal(deltas, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        this.header = new BufferInternal(header, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    }
}
