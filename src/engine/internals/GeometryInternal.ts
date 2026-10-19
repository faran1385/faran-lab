import {v4 as uuidv4} from "uuid";
import {GeometryInternalHashProvider} from "../hashing/GeometryInternalHashProvider.ts";

export class GeometryInternal {
    readonly uuid: string;
    private vertexLayouts = new Map<number, GPUVertexBufferLayout>();
    readonly hashProvider: GeometryInternalHashProvider;

    constructor() {
        this.uuid = uuidv4()
        this.hashProvider = new GeometryInternalHashProvider({getVertexLayouts: () => this.vertexLayouts});
    }

    setVertexLayout(index: number, layout: GPUVertexBufferLayout) {
        this.vertexLayouts.set(index, layout);
        this.hashProvider.markChanged();
    }

    removeVertexLayout(index: number) {
        this.vertexLayouts.delete(index);
        this.hashProvider.markChanged();
    }
}