import {ResourceManager} from "./Manager.ts";
import {BindGroupLayoutTracker, BindGroupTracker} from "../Trackers/Trackers.ts";
import type {BindGroupLayoutManager} from "./BindGroupLayoutManager.ts";
import type {TextureManager} from "./TextureManager.ts";
import type {SamplerManager} from "./SamplerManager.ts";
import type {BufferManager} from "./BufferManager.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import {BindGroupProducer} from "../descriptorProducer/BindGroupProducer.ts";

interface BindGroupCreationInput {
    material: MaterialWrapper;
    layout: BindGroupLayoutTracker;
    textureManager: TextureManager;
    samplerManager: SamplerManager;
    bufferManager: BufferManager;
}

export class BindGroupManager extends ResourceManager<BindGroupCreationInput, GPUBindGroup, BindGroupTracker> {
    createOrGetFromMaterial(
        material: MaterialWrapper,
        layoutManager: BindGroupLayoutManager,
        textureManager: TextureManager,
        samplerManager: SamplerManager,
        bufferManager: BufferManager,
    ): BindGroupTracker {
        const layout = layoutManager.createOrGetFromMaterial(material);
        return this.createOrGet({ material, layout, textureManager, samplerManager, bufferManager });
    }

    protected getHash(input: BindGroupCreationInput): string {
        return input.material.convertToBindGroupHash(this.hasher);
    }

    protected createResource(input: BindGroupCreationInput): GPUBindGroup {
        const descriptor = BindGroupProducer.produce(
            input.material,
            input.layout.raw,
            input.textureManager,
            input.samplerManager,
            input.bufferManager,
        );
        return this.device.createBindGroup(descriptor);
    }

    protected createTracker(resource: GPUBindGroup): BindGroupTracker {
        return new BindGroupTracker(resource);
    }
}