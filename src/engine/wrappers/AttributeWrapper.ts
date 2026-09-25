import type {VertexFormat} from "../importers/utils/IR.ts";
import {BufferWrapper} from "./BufferWrapper.ts";
import {HashHandler} from "../hashing/HashHandler.ts";
import {getVertexFormatSize} from "../producers/utils.ts";

export class AttributeWrapper extends BufferWrapper<GPUBufferUsage["VERTEX"]> {
    readonly name: string;
    readonly format: VertexFormat;
    readonly stride: number

    constructor(name: string, data: ArrayBuffer, format: VertexFormat) {
        super(data, GPUBufferUsage.VERTEX);
        this.name = name;
        this.format = format;
        this.hashHandler = new HashHandler(() => `${this.uuid}|${this.hashHandler.getVersion()}`);
        this.stride = getVertexFormatSize(format) || 0;
    }
}