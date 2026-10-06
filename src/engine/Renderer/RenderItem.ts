import type {HashData} from "../hashing/utils/HashData.ts";

export interface DrawInfo {
    indexed: boolean;
    count: number
    indexBuffer?: GPUBuffer;
    indexFormat?: GPUIndexFormat;
}

export interface VertexBufferBinding {
    slot: number;
    buffer: GPUBuffer;
}

export interface BindGroupBinding {
    slot: number;
    bindGroup: GPUBindGroup;
}

export interface RenderItem {
    hashData: HashData,
    /**
     * One pipeline per cull-mode variant, in draw order (back faces before front faces for double-sided blend).
     * Everything else in the item is shared by all of them.
     */
    pipelines: GPURenderPipeline[];
    bindGroups: BindGroupBinding[];
    vertexBuffers: VertexBufferBinding[];
    draw: DrawInfo;
}
