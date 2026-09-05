import type {AttributeName, VertexFormat} from "../importers/utils/IR.ts";
import type {Hasher} from "../hashing/Hasher.ts";
import {BufferWrapper} from "./BufferWrapper.ts";
import {HashHandler} from "../hashing/HashHandler.ts";

export class VertexAttributeWrapper extends BufferWrapper<GPUBufferUsage["VERTEX"]> {
    readonly name: AttributeName;

    private format: VertexFormat;
    private formatHashHandler: HashHandler;

    constructor(name: AttributeName, data: ArrayBuffer, format: VertexFormat) {
        super(data, GPUBufferUsage.VERTEX);
        this.name = name;
        this.format = format;
        this.formatHashHandler = new HashHandler(() => `${this.name}|${this.format}`);
    }

    getFormat(): VertexFormat {
        return this.format;
    }

    setFormat(format: VertexFormat): void {
        this.format = format;
        this.formatHashHandler.addVersion();
    }

    getFormatVersion(): number {
        return this.formatHashHandler.getVersion();
    }

    convertDataToHash(hasher: Hasher): string {
        return super.convertToHash(hasher);
    }

    convertToFormatHash(hasher: Hasher): string {
        return this.formatHashHandler.convertToHash(hasher);
    }

    drainFormatTrash(): string[] {
        return this.formatHashHandler.drainTrash();
    }
}