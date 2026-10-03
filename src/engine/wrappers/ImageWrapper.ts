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

        this.hashProvider = new ImageHashProvider(this.uuid, this.getDimensions.bind(this), this.getFormat.bind(this));
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

    setDimensions(width: number, height: number): void {
        this.width = width;
        this.height = height;

        this.hashProvider.markHashHandler()
        this.hashProvider.markChangeStamp();
    }

    setFormat(format: GPUTextureFormat): void {
        this.format = format;
        this.hashProvider.markHashHandler()
        this.hashProvider.markChangeStamp();
    }

    setData(data: ArrayBuffer) {
        this.data = data;
        this.hashProvider.markNeedsUpdate()
        this.hashProvider.markChangeStamp()
    }

}