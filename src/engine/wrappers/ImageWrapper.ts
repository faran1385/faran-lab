import {v4 as uuidv4} from 'uuid';
import type {Hasher} from "../hashing/Hasher.ts";
import {HashHandler} from "../hashing/HashHandler.ts";

export class ImageWrapper {
    readonly uuid: string;

    private data: ArrayBuffer;
    private width: number;
    private height: number;
    private format: GPUTextureFormat = "rgba8unorm";

    private hashHandler: HashHandler;

    constructor(data: ArrayBuffer, width: number, height: number) {
        this.uuid = uuidv4();
        this.data = data;
        this.width = width;
        this.height = height;
        this.hashHandler = new HashHandler(() => `${this.uuid}|${this.hashHandler.getVersion()}`);
    }

    getFormat(): GPUTextureFormat {
        return this.format;
    }

    getDimensions() {
        return {
            width: this.width,
            height: this.height
        };
    }

    getData(): ArrayBuffer {
        return this.data;
    }

    setFormat(format: GPUTextureFormat): void {
        this.format = format;
        this.hashHandler.addVersion();
    }

    setImage(data: ArrayBuffer, width: number, height: number, format: GPUTextureFormat): void {
        this.data = data;
        this.width = width;
        this.height = height;
        this.format = format;
        this.hashHandler.addVersion();
    }

    convertToHash(hasher: Hasher): string {
        return this.hashHandler.convertToHash(hasher);
    }

    drainTrash(): string[] {
        return this.hashHandler.drainTrash();
    }
}