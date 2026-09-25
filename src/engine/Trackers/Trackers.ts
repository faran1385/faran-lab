import {DestructibleTracker} from "./DestructibleTracker.ts";
import {IndestructibleTracker} from "./IndestructibleTracker.ts";

export class BufferTracker extends DestructibleTracker<GPUBuffer> {
    constructor(resource: GPUBuffer) {
        super(resource, "buffer");
    }
}

export class TextureTracker extends DestructibleTracker<GPUTexture> {
    private views = new Map<string, GPUTextureView>();

    constructor(resource: GPUTexture) {
        super(resource, "texture");
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
    constructor(resource: GPUBindGroup) {
        super(resource, "bindGroup");
    }
}

export class BindGroupLayoutTracker extends IndestructibleTracker<GPUBindGroupLayout> {
    constructor(resource: GPUBindGroupLayout) {
        super(resource, "bindGroupLayout");
    }
}

export class PipelineLayoutTracker extends IndestructibleTracker<GPUPipelineLayout> {
    constructor(resource: GPUPipelineLayout) {
        super(resource, "pipelineLayout");
    }
}

export class PipelineTracker extends IndestructibleTracker<GPURenderPipeline> {
    constructor(resource: GPURenderPipeline) {
        super(resource, "pipeline");
    }
}

export class ShaderModuleTracker extends IndestructibleTracker<GPUShaderModule> {
    constructor(resource: GPUShaderModule) {
        super(resource, "shaderModule");
    }
}

export class SamplerTracker extends IndestructibleTracker<GPUSampler> {
    constructor(resource: GPUSampler) {
        super(resource, "sampler");
    }
}