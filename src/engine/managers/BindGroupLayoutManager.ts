import {BindGroupLayoutTracker} from "../Trackers/Trackers.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import {BindGroupLayoutDescriptorProducer} from "../descriptorProducer/BindGroupLayoutDescriptorProducer.ts";
import {ResourceManager} from "./Manager.ts";

export class BindGroupLayoutManager extends ResourceManager<MaterialWrapper, GPUBindGroupLayout, BindGroupLayoutTracker> {

    static readonly SCENE_LAYOUT_DESCRIPTOR: GPUBindGroupLayoutDescriptor = {
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: "uniform",
                    minBindingSize: 128,
                },
            },
        ],
    };

    static readonly NODE_LAYOUT_DESCRIPTOR: GPUBindGroupLayoutDescriptor = {
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: "uniform",
                    minBindingSize: 64,
                },
            },
        ],
    };

    private sceneLayoutTracker?: BindGroupLayoutTracker;
    private nodeLayoutTracker?: BindGroupLayoutTracker;

    getOrCreateSceneLayout(): BindGroupLayoutTracker {
        if (!this.sceneLayoutTracker) {
            const layout = this.device.createBindGroupLayout(BindGroupLayoutManager.SCENE_LAYOUT_DESCRIPTOR);
            this.sceneLayoutTracker = new BindGroupLayoutTracker(layout);
        }
        return this.sceneLayoutTracker;
    }

    getOrCreateNodeLayout(): BindGroupLayoutTracker {
        if (!this.nodeLayoutTracker) {
            const layout = this.device.createBindGroupLayout(BindGroupLayoutManager.NODE_LAYOUT_DESCRIPTOR);
            this.nodeLayoutTracker = new BindGroupLayoutTracker(layout);
        }
        return this.nodeLayoutTracker;
    }

    createOrGetFromMaterial(material: MaterialWrapper): BindGroupLayoutTracker {
        return this.createOrGet(material);
    }

    protected getHash(material: MaterialWrapper): string {
        return material.convertToBindGroupLayoutHash(this.hasher);
    }

    protected createResource(material: MaterialWrapper): GPUBindGroupLayout {
        const descriptor = BindGroupLayoutDescriptorProducer.produce(material);
        return this.device.createBindGroupLayout(descriptor);
    }

    protected createTracker(resource: GPUBindGroupLayout): BindGroupLayoutTracker {
        return new BindGroupLayoutTracker(resource);
    }
}