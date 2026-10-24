import type {VertexFormat} from "../importers/utils/IR.ts";
import {getVertexFormatSize} from "../producers/utils.ts";
import {AttributeAdaptor} from "../Adaptors/AttributeAdaptor.ts";

export type TypedArray =
    | Int8Array<ArrayBuffer>
    | Uint8Array<ArrayBuffer>
    | Uint8ClampedArray<ArrayBuffer>
    | Int16Array<ArrayBuffer>
    | Uint16Array<ArrayBuffer>
    | Int32Array<ArrayBuffer>
    | Uint32Array<ArrayBuffer>
    | Float32Array<ArrayBuffer>
    | Float64Array<ArrayBuffer>
    | BigInt64Array<ArrayBuffer>
    | BigUint64Array<ArrayBuffer>;

export class AttributeWrapper {
    readonly adaptor: AttributeAdaptor;
    readonly name: string;
    readonly format: VertexFormat;
    readonly stride: number;

    constructor(name: string, data: ArrayBuffer, format: VertexFormat) {
        this.name = name;
        this.format = format;
        this.stride = getVertexFormatSize(format);
        this.adaptor = new AttributeAdaptor(data);
    }

    getData(): ArrayBuffer {
        return this.adaptor.internal.getData();
    }

    /** Replace attribute bytes without changing the buffer's allocated size. */
    setData(data: ArrayBuffer | TypedArray): void {
        const bytes = data instanceof ArrayBuffer
            ? data
            : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
        this.adaptor.internal.setData(bytes);
    }
}
