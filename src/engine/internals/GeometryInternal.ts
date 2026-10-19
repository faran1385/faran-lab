import { v4 as uuidv4 } from "uuid";
import { GeometryInternalHashProvider } from "../hashing/GeometryInternalHashProvider.ts";
import { AttributeInternal } from "./AttributeInternal.ts";
import type { BufferWrapper } from "../wrappers/BufferWrapper.ts";

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
    indexBuffer: BufferWrapper;
};

export class GeometryInternal {
    readonly uuid: string;
    private vertexAttributes = new Map<number, AttributeInternal>();
    readonly hashProvider: GeometryInternalHashProvider;
    private drawInfo!: Draw | DrawIndexed;

    constructor() {
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
