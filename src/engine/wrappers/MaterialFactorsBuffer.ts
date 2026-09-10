import {BufferWrapper} from "./BufferWrapper.ts";
import {HashHandler} from "../hashing/HashHandler.ts";
import type {Hasher} from "../hashing/Hasher.ts";

export class MaterialFactorsBuffer extends BufferWrapper<GPUBufferUsage["VERTEX"]> {


    constructor(data: ArrayBuffer, matUUID: string) {
        super(data, GPUBufferUsage.UNIFORM);
        this.hashHandler = new HashHandler(() => `${matUUID}`);
    }


    convertDataToHash(hasher: Hasher): string {
        return super.convertToHash(hasher);
    }
}