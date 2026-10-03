import type {VertexFormat} from "../importers/utils/IR.ts";
import {BufferWrapper} from "./BufferWrapper.ts";
import {getVertexFormatSize} from "../producers/utils.ts";

export class AttributeWrapper extends BufferWrapper<GPUBufferUsage["VERTEX"] | GPUBufferUsage["COPY_DST"]> {
    readonly name: string;
    readonly format: VertexFormat;
    readonly stride: number

    constructor(name: string, data: ArrayBuffer, format: VertexFormat) {
        super(data, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
        this.name = name;
        this.format = format;
        this.stride = getVertexFormatSize(format) || 0;
    }
}