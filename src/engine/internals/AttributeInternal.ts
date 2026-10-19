import {BufferWrapper} from "../wrappers/BufferWrapper.ts";


export class AttributeInternal extends BufferWrapper<GPUBufferUsage["VERTEX"] | GPUBufferUsage["COPY_DST"]> {
    private layout: GPUVertexBufferLayout

    constructor(data: ArrayBuffer, layout: GPUVertexBufferLayout) {
        super(data, GPUBufferUsage["VERTEX"] | GPUBufferUsage["COPY_DST"]);
        this.layout = layout;
    }

    getLayout() {
        return this.layout;
    }
}