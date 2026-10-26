import {v4 as uuidv4} from "uuid";
import {GeometryInternalHashProvider} from "../hashing/GeometryInternalHashProvider.ts";
import {AttributeInternal} from "./AttributeInternal.ts";
import type {BufferInternal} from "./BufferInternal.ts";
import {BindgroupInteractor} from "../Representations/BindgroupInteractor.ts";

export type Draw = {
    vertexCount: number;
    instanceCount?: number;
    firstVertex?: number;
    firstInstance?: number;
};

export type DrawIndexed = {
    indexCount: number;
    instanceCount?: number;
    firstIndex?: number;
    baseVertex?: number;
    firstInstance?: number;
    indexBuffer: BufferInternal;
    /** Needed by setIndexBuffer; the buffer alone does not say whether it holds 16 or 32 bit indices. */
    indexFormat: GPUIndexFormat;
};

export class GeometryInternal {
    readonly uuid: string;
    private vertexAttributes = new Map<number, AttributeInternal>();
    readonly hashProvider: GeometryInternalHashProvider;
    private drawInfo!: Draw | DrawIndexed;

    readonly group: number;
    readonly bindgroupInteractor = new BindgroupInteractor();

    constructor(group?: number) {
        this.group = group ?? 3;

        this.uuid = uuidv4();
        this.hashProvider = new GeometryInternalHashProvider({
            getVertexAttributes: () => this.vertexAttributes,
            getDrawInfo: () => this.drawInfo,
        });
    }

    getVertexAttributes() {
        return this.vertexAttributes;
    }

    setDrawInfo(info: Draw | DrawIndexed) {
        this.drawInfo = info;
        this.hashProvider.markChanged();
    }

    getDrawInfo() {
        return this.drawInfo;
    }

    setVertexAttribute(slot: number, attribute: AttributeInternal) {
        this.vertexAttributes.set(slot, attribute);
        this.hashProvider.markChanged();
    }

    removeVertexAttribute(slot: number) {
        if (this.vertexAttributes.delete(slot)) this.hashProvider.markChanged();
    }
}
