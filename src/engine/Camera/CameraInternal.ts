import {BufferInternal} from "../internals/BufferInternal.ts";

/**
 * CPU-side camera resource. The two column-major mat4 values occupy one 128-byte uniform buffer:
 * view at byte offset 0 and projection at byte offset 64.
 */
export class CameraInternal {
    readonly buffer = new BufferInternal(
        new ArrayBuffer(128),
        GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    );

    getBuffer(): BufferInternal {
        return this.buffer;
    }
}
