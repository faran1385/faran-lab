import type {VertexFormat} from "../importers/utils/IR.ts";
import {getVertexFormatSize} from "../producers/utils.ts";
import {AttributeAdaptor} from "../Adaptors/AttributeAdaptor.ts";

export class AttributeWrapper {
    readonly adaptor: AttributeAdaptor
    readonly name: string;
    readonly format: VertexFormat;
    readonly stride: number

    constructor(name: string, data: ArrayBuffer, format: VertexFormat) {
        this.name = name;
        this.format = format;
        this.stride = getVertexFormatSize(format) || 0;

        this.adaptor = new AttributeAdaptor(data, {
            attributes: [{
                format,
                offset: 0,
                shaderLocation: 0
            }],
            arrayStride: this.stride,
            stepMode: "vertex"
        });
    }
}