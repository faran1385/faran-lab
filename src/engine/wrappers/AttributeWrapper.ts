import type {VertexFormat} from "../importers/utils/IR.ts";
import {v4 as uuidv4} from 'uuid';

export class AttributeWrapper {
    readonly uuid: string;
    readonly name: string;

    private format: VertexFormat;
    private data: ArrayBuffer;

    constructor(name: string, data: ArrayBuffer, format: VertexFormat) {
        this.uuid = uuidv4();
        this.name = name;
        this.format = format;
        this.data = data;
    }


}