import {BufferWrapper} from "./BufferWrapper.ts";
import type {Hasher} from "../hashing/Hasher.ts";
import {HashHandler} from "../hashing/HashHandler.ts";

export type IndexFormat = "uint16" | "uint32";

export class IndexAttributeWrapper extends BufferWrapper<GPUBufferUsage["INDEX"]> {
    private format: IndexFormat;
    private formatHashHandler: HashHandler;

    constructor(data: ArrayBuffer, format: IndexFormat) {
        super(data, GPUBufferUsage.INDEX);
        this.format = format;
        this.hashHandler = new HashHandler(() => `${this.uuid}|${this.hashHandler.getVersion()}`);
        this.formatHashHandler = new HashHandler(() => `${this.format}`);
    }

    getFormat(): IndexFormat {
        return this.format;
    }

    setFormat(format: IndexFormat): void {
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