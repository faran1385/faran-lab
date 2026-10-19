import {v4 as uuidv4} from "uuid";

export class GeometryInternal {
    readonly uuid: string;

    constructor() {
        this.uuid = uuidv4()
    }

    private vertexLayouts = new Map<number, GPUVertexBufferLayout>();

    setVertexLayout(index: number, layout: GPUVertexBufferLayout) {
        this.vertexLayouts.set(index, layout);
    }

    removeVertexLayout(index: number) {
        this.vertexLayouts.delete(index);
    }
}