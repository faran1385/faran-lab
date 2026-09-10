import type {PipelineWrapper} from "../wrappers/PipelineWrapper.ts";
import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import {PipelineLayoutTracker, PipelineTracker, ShaderModuleTracker} from "../Trackers/Trackers.ts";
import {ResourceManager} from "./Manager.ts";
import type {ShaderModuleManager} from "./ShaderModuleManager.ts";
import type {PipelineLayoutManager} from "./PipelineLayoutManager.ts";
import type {BindGroupLayoutManager} from "./BindGroupLayoutManager.ts";
import {PipelineDescriptorProducer} from "../descriptorProducer/PipelineDescriptorProducer.ts";

interface PipelineCreationInput {
    pipeline: PipelineWrapper;
    primitive: PrimitiveWrapper;
    pipelineLayout: PipelineLayoutTracker;
    vertexModule: ShaderModuleTracker;
    fragmentModule: ShaderModuleTracker;
}

export class PipelineManager extends ResourceManager<PipelineCreationInput, GPURenderPipeline, PipelineTracker> {
    createOrGetFromPipeline(
        primitive: PrimitiveWrapper,
        layoutManager: BindGroupLayoutManager,
        pipelineLayoutManager: PipelineLayoutManager,
        shaderModuleManager: ShaderModuleManager,
    ): PipelineTracker {
        const pipeline=primitive.getPipeline()
        const pipelineLayout = pipelineLayoutManager.createOrGetFromMaterial(primitive.getMaterial(), layoutManager);
        const vertexModule = shaderModuleManager.createOrGetFromSource(pipeline.getVertexShaderWrapper());
        const fragmentModule = shaderModuleManager.createOrGetFromSource(pipeline.getFragmentShaderWrapper());

        return this.createOrGet({ pipeline, primitive, pipelineLayout, vertexModule, fragmentModule });
    }

    protected getHash(input: PipelineCreationInput): string {
        return input.pipeline.computeHash(input.primitive, this.hasher);
    }

    protected createResource(input: PipelineCreationInput): GPURenderPipeline {
        const descriptor = PipelineDescriptorProducer.produce(
            input.pipeline,
            input.primitive,
            input.pipelineLayout.raw,
            input.vertexModule.raw,
            input.fragmentModule.raw,
        );
        return this.device.createRenderPipeline(descriptor);
    }

    protected createTracker(resource: GPURenderPipeline): PipelineTracker {
        return new PipelineTracker(resource);
    }
}