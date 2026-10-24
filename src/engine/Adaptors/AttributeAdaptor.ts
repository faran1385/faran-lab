import {AttributeInternal} from "../internals/AttributeInternal.ts";

export class AttributeAdaptor {
    readonly internal: AttributeInternal;


    constructor(data: ArrayBuffer) {
        this.internal = new AttributeInternal(data)
    }
}