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

    /**
     * The layout depends on the slot/location the owning geometry assigned, so it changes without the data changing.
     * Only the change stamp moves (the geometry hash is rebuilt); the buffer contents are not re-uploaded.
     */
    setLayout(layout: GPUVertexBufferLayout) {
        this.layout = layout;
        this.hashProvider.markChangeStamp();
    }
}
