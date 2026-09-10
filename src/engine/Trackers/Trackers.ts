import {DestructibleTracker} from "./DestructibleTracker.ts";
import {IndestructibleTracker} from "./IndestructibleTracker.ts";

export class BufferTracker extends DestructibleTracker<GPUBuffer> {
    constructor(resource: GPUBuffer, startLife?: number) {
        super(resource, "buffer", startLife);
    }
}

export class TextureTracker extends DestructibleTracker<GPUTexture> {
    private views = new Map<string, GPUTextureView>();

    constructor(resource: GPUTexture, startLife?: number) {
        super(resource, "texture", startLife);
    }

    getOrCreateView(key: string, descriptor: GPUTextureViewDescriptor): GPUTextureView {
        const existing = this.views.get(key);
        if (existing) return existing;

        const view = this.raw.createView(descriptor);
        this.views.set(key, view);
        return view;
    }
}
export class BindGroupTracker extends IndestructibleTracker<GPUBindGroup> {
    constructor(resource: GPUBindGroup, startLife?: number) {
        super(resource, "bindGroup", startLife);
    }
}

export class BindGroupLayoutTracker extends IndestructibleTracker<GPUBindGroupLayout> {
    constructor(resource: GPUBindGroupLayout, startLife?: number) {
        super(resource, "bindGroupLayout", startLife);
    }
}

export class PipelineLayoutTracker extends IndestructibleTracker<GPUPipelineLayout> {
    constructor(resource: GPUPipelineLayout, startLife?: number) {
        super(resource, "pipelineLayout", startLife);
    }
}

export class PipelineTracker extends IndestructibleTracker<GPURenderPipeline> {
    constructor(resource: GPURenderPipeline, startLife?: number) {
        super(resource, "pipeline", startLife);
    }
}

export class ShaderModuleTracker extends IndestructibleTracker<GPUShaderModule> {
    constructor(resource: GPUShaderModule, startLife?: number) {
        super(resource, "shaderModule", startLife);
    }
}

export class SamplerTracker extends IndestructibleTracker<GPUSampler> {
    constructor(resource: GPUSampler, startLife?: number) {
        super(resource, "sampler", startLife);
    }
}