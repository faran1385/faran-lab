import {v4 as uuidv4} from "uuid";
import {GeometryInternalHashProvider} from "../hashing/GeometryInternalHashProvider.ts";
import {AttributeInternal} from "./AttributeInternal.ts";
import type {BufferWrapper} from "../wrappers/BufferWrapper.ts";

export type Draw = {
    vertexCount: number,
    instanceCount?: number,  // default 1
    firstVertex?: number,    // default 0
    firstInstance?: number // default 0
}

export type DrawIndexed = {
    indexCount: number,
    instanceCount?: number,
    firstIndex?: number,
    baseVertex?: number,
    firstInstance?: number,
    indexBuffer: BufferWrapper
}

export class GeometryInternal {
    readonly uuid: string;
    private vertexAttributes = new Map<number, AttributeInternal>();
    readonly hashProvider!: GeometryInternalHashProvider;
    private drawInfo!: Draw | DrawIndexed


    constructor() {
        this.uuid = uuidv4()
    }

    getVertexAttributes() {
        return this.vertexAttributes;
    }

    setDrawInfo(info: Draw | DrawIndexed) {
        this.drawInfo = info;
    }

    getDrawInfo() {
        return this.drawInfo;
    }

    setVertexAttribute(slot: number, attribute: AttributeInternal) {
        this.vertexAttributes.set(slot, attribute);
    }

    removeVertexAttribute(slot: number) {
        this.vertexAttributes.delete(slot);
    }
}