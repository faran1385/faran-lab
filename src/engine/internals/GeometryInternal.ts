export class GeometryInternal {
    private vertexLayouts = new Map<number, GPUVertexBufferLayout>();

    setVertexLayout(index: number, layout: GPUVertexBufferLayout) {
        this.vertexLayouts.set(index, layout);
    }

    removeVertexLayout(index: number) {
        this.vertexLayouts.delete(index);
    }
}