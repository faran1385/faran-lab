import {v4 as uuidv4} from 'uuid';
import type {Hasher} from "../hashing/Hasher.ts";

export class ImageWrapper {

    readonly uuid: string;

    private data: ArrayBuffer;
    private width: number;
    private format: GPUTextureFormat = "rgba8unorm"
    private height: number;
    private version = 0;

    private cachedHash: string | null = null;
    private cachedHashVersion = -1;


    constructor(
        data: ArrayBuffer,
        width: number,
        height: number,
    ) {
        this.uuid = uuidv4();
        this.data = data;
        this.width = width;
        this.height = height;
    }


    getFormat(): GPUTextureFormat {
        return this.format;
    }

    getDimensions() {
        return {
            width: this.width,
            height: this.height
        }
    }

    getData(): ArrayBuffer {
        return this.data;
    }

    setFormat(format: GPUTextureFormat) {
        this.format = format;
    }

    setImage(data: ArrayBuffer, width: number, height: number, format: GPUTextureFormat): void {
        this.data = data;
        this.width = width;
        this.height = height;
        this.format = format;
        this.version++;
    }

    convertToHash(hasher: Hasher): string {

        if (
            this.cachedHash === null ||
            this.cachedHashVersion !== this.version
        ) {
            this.cachedHash = this.computeHash(hasher);
            this.cachedHashVersion = this.version;
        }

        return this.cachedHash;
    }


    private computeHash(hasher: Hasher): string {

        return hasher.hashString(
            `${this.uuid}|${this.version}`
        );
    }
}