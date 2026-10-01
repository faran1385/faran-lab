import {v4 as uuidv4} from 'uuid';
import {ImageHashProvider} from "../hashing/ImageHashProvider.ts";

export class ImageWrapper {
    readonly uuid: string;

    private data: ArrayBuffer;
    private width: number;
    private height: number;
    private format: GPUTextureFormat = "rgba8unorm";
    readonly hashProvider: ImageHashProvider;

    constructor(data: ArrayBuffer, width: number, height: number, format: GPUTextureFormat = "rgba8unorm") {
        this.uuid = uuidv4();
        this.data = data;
        this.width = width;
        this.height = height;
        this.format = format;

        this.hashProvider = new ImageHashProvider(this.uuid)
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

    setImage(data: ArrayBuffer, width: number, height: number, format: GPUTextureFormat): void {
        this.data = data;
        this.width = width;
        this.height = height;
        this.format = format;
        this.hashProvider.markHashHandler()
        this.hashProvider.markChangeStamp();
    }

}