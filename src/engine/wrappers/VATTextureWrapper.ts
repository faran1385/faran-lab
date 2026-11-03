import {ImageWrapper} from "./ImageWrapper.ts";
import {BufferInternal} from "../internals/BufferInternal.ts";


export class VATTextureWrapper {
    readonly headerBuffer: BufferInternal;
    readonly texture: ImageWrapper;
    readonly usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST

    constructor(data: ArrayBuffer, width: number, height: number, format?: GPUTextureFormat) {
        this.texture = new ImageWrapper(data, width, height, format);
        this.headerBuffer = new BufferInternal(new Float32Array([0, width, height, 0]).buffer, GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM);
    }
}