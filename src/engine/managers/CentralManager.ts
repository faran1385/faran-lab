import {BufferManager} from "./BufferManager.ts";
import {ShaderModuleManager} from "./ShaderModuleManager.ts";
import {SamplerManager} from "./SamplerManager.ts";
import {TextureManager} from "./TextureManager.ts";
import {PipelineLayoutManager} from "./PipelineLayoutManager.ts";
import {BindGroupManager} from "./BindGroupManager.ts";
import {PipelineManager} from "./PipelineManager.ts";
import {BindGroupLayoutManager} from "./BindGroupLayoutManager.ts";

export class CentralManager {
    readonly bufferManager: BufferManager;
    readonly shaderModuleManager: ShaderModuleManager;
    readonly samplerManager: SamplerManager;
    readonly textureManager: TextureManager;
    readonly pipelineLayoutManager: PipelineLayoutManager;
    readonly bindgroupManager: BindGroupManager;
    readonly pipelineManager: PipelineManager;
    readonly bindgroupLayoutManager: BindGroupLayoutManager;

    constructor(device: GPUDevice) {
        this.bufferManager = new BufferManager(device);
        this.shaderModuleManager = new ShaderModuleManager(device);
        this.samplerManager = new SamplerManager(device);
        this.textureManager = new TextureManager(device);
        this.pipelineLayoutManager = new PipelineLayoutManager(device);
        this.bindgroupManager = new BindGroupManager(device);
        this.pipelineManager = new PipelineManager(device);
        this.bindgroupLayoutManager = new BindGroupLayoutManager(device);
    }
}