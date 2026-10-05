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
    pipeline: GPURenderPipeline;
    bindGroups: BindGroupBinding[];
    vertexBuffers: VertexBufferBinding[];
    draw: DrawInfo;
}
