import {BufferWrapper} from "../wrappers/BufferWrapper.ts";

/**
 * How a vertex buffer gets its bytes. Unlike AttributeWrapper (one attribute, one format), this holds whatever bytes
 * you give it, so one buffer can carry several interleaved attributes: what is inside is declared by the
 * VertexLayoutSet that uses it, not by the buffer.
 */
export type VertexBufferSource = { byteSize: number } | { data: ArrayBuffer };

/** A vertex buffer of raw bytes. Identity-keyed like every buffer: its GPU buffer is keyed by uuid. */
export class VertexBufferWrapper extends BufferWrapper {
    constructor(source: VertexBufferSource) {
        super(VertexBufferWrapper.dataOf(source), GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
    }

    private static dataOf(source: VertexBufferSource): ArrayBuffer {
        if ("data" in source) return source.data;
        if (!Number.isInteger(source.byteSize) || source.byteSize <= 0) {
            throw new Error(`a vertex buffer needs a positive whole byteSize, got ${source.byteSize}`);
        }
        return new ArrayBuffer(source.byteSize);
    }
}
