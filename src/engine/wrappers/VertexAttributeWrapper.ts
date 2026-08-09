// wrappers/VertexAttributeWrapper.ts
import {AttributeWrapperBase} from "./AttributeWrapperBase.ts";
import type {AttributeName, VertexFormat} from "../importers/utils/IR.ts";

export class VertexAttributeWrapper extends AttributeWrapperBase<VertexFormat> {
    readonly name: AttributeName;

    constructor(name: AttributeName, data: ArrayBuffer, format: VertexFormat) {
        super(data, format);
        this.name = name;
    }
}