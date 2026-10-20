import {BufferInternal} from "../internals/BufferInternal.ts";

export type IndexFormat = "uint16" | "uint32";

export class IndexAttributeWrapper extends BufferInternal<GPUBufferUsage["INDEX"]> {
    readonly format: IndexFormat;

    constructor(data: ArrayBuffer, format: IndexFormat) {
        super(data, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST);
        this.format = format;
    }
}