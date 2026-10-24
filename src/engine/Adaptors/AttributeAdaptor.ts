import {AttributeInternal} from "../internals/AttributeInternal.ts";

export class AttributeAdaptor {
    readonly internal: AttributeInternal;


    constructor(data: ArrayBuffer, layout: GPUVertexBufferLayout) {
        this.internal = new AttributeInternal(data, layout)
    }
}