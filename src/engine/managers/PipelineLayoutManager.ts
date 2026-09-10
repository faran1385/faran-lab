import {ResourceManager} from "./Manager.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {BindGroupLayoutManager} from "./BindGroupLayoutManager.ts";
import {BindGroupLayoutTracker, PipelineLayoutTracker} from "../Trackers/Trackers.ts";

interface PipelineLayoutCreationInput {
    material: MaterialWrapper;
    materialLayout: BindGroupLayoutTracker;
    sceneLayout: BindGroupLayoutTracker;
    nodeLayout: BindGroupLayoutTracker;
}

export class PipelineLayoutManager extends ResourceManager<PipelineLayoutCreationInput, GPUPipelineLayout, PipelineLayoutTracker> {
    createOrGetFromMaterial(
        material: MaterialWrapper,
        layoutManager: BindGroupLayoutManager,
    ): PipelineLayoutTracker {
        const materialLayout = layoutManager.createOrGetFromMaterial(material);
        const sceneLayout = layoutManager.getOrCreateSceneLayout();
        const nodeLayout = layoutManager.getOrCreateNodeLayout();

        return this.createOrGet({ material, materialLayout, sceneLayout, nodeLayout });
    }

    protected getHash(input: PipelineLayoutCreationInput): string {
        return input.material.convertToBindGroupLayoutHash(this.hasher);
    }

    protected createResource(input: PipelineLayoutCreationInput): GPUPipelineLayout {
        return this.device.createPipelineLayout({
            bindGroupLayouts: [
                input.sceneLayout.raw,
                input.materialLayout.raw,
                input.nodeLayout.raw,
            ],
        });
    }

    protected createTracker(resource: GPUPipelineLayout): PipelineLayoutTracker {
        return new PipelineLayoutTracker(resource);
    }
}