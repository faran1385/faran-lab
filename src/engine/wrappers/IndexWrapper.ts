import {AttributeWrapperBase} from "./AttributeWrapperBase.ts";

export type IndexFormat = "uint16" | "uint32";

export class IndexAttributeWrapper extends AttributeWrapperBase<IndexFormat, GPUBufferUsage["INDEX"]> {
    constructor(data: ArrayBuffer, format: IndexFormat) {
        super(data, format, GPUBufferUsage.INDEX);
    }

}