export type DrawCall =
    | {
    indexed: false;
    vertexCount: number;
    instanceCount: number;
    firstVertex: number;
    firstInstance: number;
}
    | {
    indexed: true;
    indexBuffer: GPUBuffer;
    indexFormat: GPUIndexFormat;
    indexCount: number;
    instanceCount: number;
    firstIndex: number;
    baseVertex: number;
    firstInstance: number;
};

export interface VertexBufferBinding {
    slot: number;
    buffer: GPUBuffer;
}

export interface BindGroupBinding {
    slot: number;
    bindGroup: GPUBindGroup;
}

/** Everything needed to draw one primitive of one node. Raw GPU objects only: drawing it reads nothing else. */
export interface RenderItem {
    /**
     * One pipeline per cull-mode variant, in draw order (back faces before front faces for double-sided blend).
     * Everything else in the item is shared by all of them.
     */
    pipelines: GPURenderPipeline[];
    bindGroups: BindGroupBinding[];
    vertexBuffers: VertexBufferBinding[];
    draw: DrawCall;
}
