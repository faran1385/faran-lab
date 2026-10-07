import {BufferWrapper} from "./BufferWrapper.ts";

export type IndexFormat = "uint16" | "uint32";

export class IndexAttributeWrapper extends BufferWrapper<GPUBufferUsage["INDEX"]> {
    readonly format: IndexFormat;

    constructor(data: ArrayBuffer, format: IndexFormat) {
        super(data, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST);
        this.format = format;
    }
}