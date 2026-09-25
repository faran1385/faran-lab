import {BufferWrapper} from "./BufferWrapper.ts";

export type IndexFormat = "uint16" | "uint32";

export class IndexAttributeWrapper extends BufferWrapper<GPUBufferUsage["INDEX"]> {
    private format: IndexFormat;

    constructor(data: ArrayBuffer, format: IndexFormat) {
        super(data, GPUBufferUsage.INDEX);
        this.format = format;
    }

    getFormat(): IndexFormat {
        return this.format;
    }
}