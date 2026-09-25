import {BufferWrapper} from "../wrappers/BufferWrapper.ts";
import {
    type BufferDescriptor,
    BufferProducer,
    MaterialFactorBufferProducer,
    NodeMatrixBufferProducer
} from "./BufferProducer.ts";
import {BindGroupLayoutProducer, type MaterialBindingPlan} from "./BindGroupLayoutProducer.ts";
import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import {type TextureDescriptor, TextureProducer} from "./TextureDescriptorProducer.ts";
import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";
import {SamplerProducer} from "./SamplerProducer.ts";
import type {ShaderModuleWrapper} from "../wrappers/ShaderModuleWrapper.ts";
import {ShaderModuleProducer} from "./ShaderProducer.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import {
    type BindGroupProduceArgs,
    BindGroupProducer,
    type NodeBindgroupProduceArgs,
    NodeBindGroupProducer, type SceneBindgroupProduceArgs, SceneBindGroupProducer
} from "./BindGroupProducer.ts";
import {
    type MaterialFactorsPlan,
    type GeometryAttributePlan,
    planGeometryAttributes,
    planMaterialBindings,
    planMaterialFactors
} from "./utils.ts";
import {type PipelineLayoutProduceArgs, PipelineLayoutProducer} from "./PipelineLayoutProducer.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import {type PipelineProduceArgs, PipelineProducer} from "./PipelineProducer.ts";
import {
    type FragmentShaderDescriptor,
    FragmentShaderProducer,
    type VertexShaderDescriptor, VertexShaderProducer
} from "./AssemblerProducers.ts";
import type {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import type {Camera} from "../Camera/Camera.ts";

export class DescriptorProducer {
    private materialBindingPlans = new Map<string, MaterialBindingPlan>();
    private materialFactorPlans = new Map<string, MaterialFactorsPlan>();
    private geometryAttributePlans = new Map<string, GeometryAttributePlan>();

    produceBuffer(wrapper: BufferWrapper): BufferDescriptor {
        return BufferProducer.produce(wrapper);
    }


    produceFragmentShader(
        {material}: {
            material: MaterialWrapper;
            vertexShader: ShaderModuleWrapper;
            geometry: GeometryWrapper
        },
    ): FragmentShaderDescriptor {
        return FragmentShaderProducer.produce(
            () => this.getBindingPlan(material),
            () => this.getFactorPlan(material),
        );
    }

    produceBufferFromMatFactors(mat: MaterialWrapper) {
        return this.produceBuffer(MaterialFactorBufferProducer.produce(this.getFactorPlan(mat)))
    }

    produceBufferFromNodeMatrix(node: NodeWrapper) {
        return this.produceBuffer(NodeMatrixBufferProducer.produce(node))
    }

    produceCameraBuffer(camera: Camera) {
        return this.produceBuffer(new BufferWrapper(new Float32Array([...camera.getViewMatrix(), ...camera.getProjectionMatrix()]).buffer, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST))
    }

    produceSceneBindgroup(args: SceneBindgroupProduceArgs) {
        return SceneBindGroupProducer.produce(args)
    }

    produceBindgroupFromNode(args: NodeBindgroupProduceArgs) {
        return NodeBindGroupProducer.produce(args)
    }

    produceVertexShader(T: { geometry: GeometryWrapper, material: MaterialWrapper }): VertexShaderDescriptor {
        return VertexShaderProducer.produce(() => this.getBindingPlan(T.material), () => this.getAttributePlan(T.geometry));
    }


    produceTexture(image: ImageWrapper): TextureDescriptor {
        return TextureProducer.produce(image);
    }

    produceSampler(wrapper: SamplerWrapper): GPUSamplerDescriptor {
        return SamplerProducer.produce(wrapper);
    }

    produceShaderModule(wrapper: ShaderModuleWrapper): GPUShaderModuleDescriptor {
        return ShaderModuleProducer.produce(wrapper);
    }

    produceBindGroupLayout(material: MaterialWrapper): GPUBindGroupLayoutDescriptor {
        return BindGroupLayoutProducer.produce(material, () => this.getBindingPlan(material));
    }

    produceBindGroup(args: BindGroupProduceArgs): GPUBindGroupDescriptor {
        return BindGroupProducer.produce(args, () => this.getBindingPlan(args.material));
    }

    producePipelineLayout(args: PipelineLayoutProduceArgs): GPUPipelineLayoutDescriptor {
        return PipelineLayoutProducer.produce(args);
    }

    producePipeline(args: PipelineProduceArgs): GPURenderPipelineDescriptor {
        return PipelineProducer.produce(args, () => this.getAttributePlan(args.geometry));
    }

    clear(): void {
        this.materialBindingPlans.clear();
        this.geometryAttributePlans.clear()
        this.materialFactorPlans.clear()
    }

    private getBindingPlan(material: MaterialWrapper): MaterialBindingPlan {
        let plan = this.materialBindingPlans.get(material.uuid);
        if (!plan) {
            plan = planMaterialBindings(material.getSortedComponents());
            this.materialBindingPlans.set(material.uuid, plan);
        }
        return plan;
    }

    getAttributePlan(geometry: GeometryWrapper): GeometryAttributePlan {
        let plan = this.geometryAttributePlans.get(geometry.uuid);
        if (!plan) {
            plan = planGeometryAttributes(geometry);
            this.geometryAttributePlans.set(geometry.uuid, plan);
        }
        return plan;
    }

    getFactorPlan(material: MaterialWrapper) {
        let plan = this.materialFactorPlans.get(material.uuid);
        if (!plan) {
            plan = planMaterialFactors(material);
            this.materialFactorPlans.set(material.uuid, plan);
        }
        return plan;
    }
}