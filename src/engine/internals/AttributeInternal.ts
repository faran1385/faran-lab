import {BufferInternal} from "./BufferInternal.ts";


export class AttributeInternal extends BufferInternal<GPUBufferUsage["VERTEX"] | GPUBufferUsage["COPY_DST"]> {
    private layout: GPUVertexBufferLayout

    constructor(data: ArrayBuffer, layout: GPUVertexBufferLayout) {
        super(data, GPUBufferUsage["VERTEX"] | GPUBufferUsage["COPY_DST"]);
        this.layout = layout;
    }

    getLayout() {
        return this.layout;
    }
}