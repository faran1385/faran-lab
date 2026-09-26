import type {Camera} from "../Camera/Camera.ts";
import type {CentralManager} from "../managers/CentralManager.ts";
import type {Hasher} from "../hashing/Hasher.ts";
import type {CentralProducer} from "../producers/CentralProducer.ts";
import {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";

export interface FrameInfo {
    colorFormat: GPUTextureFormat;
    depthFormat: GPUTextureFormat;
}

export interface RenderItemBuilderContext {
    managers: CentralManager;
    producer: CentralProducer;
    hasher: Hasher;
    frame: FrameInfo;
    camera: Camera;
}

// RenderItem.ts
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
    pipeline: GPURenderPipeline;
    bindGroups: BindGroupBinding[];
    vertexBuffers: VertexBufferBinding[];
    draw: DrawInfo;
}

export class RenderItemBuilder {
    static build(node: NodeWrapper, ctx: RenderItemBuilderContext): RenderItem[] {
        const mesh = node.getMesh();
        if (!mesh) return [];

        RenderItemBuilder.ensureNodeResources(node, ctx);

        return mesh.getAllPrimitives().map((p) => RenderItemBuilder.buildPrimitive(node, p, ctx));
    }

    // ---- node-level (once per node, shared by all its primitives) ----

    private static ensureNodeResources(node: NodeWrapper, ctx: RenderItemBuilderContext): void {
        const {managers, producer} = ctx;
        managers.bufferManager.ensure(node.uuid, () => producer.produceBufferFromNodeMatrix(node));
        managers.bindgroupManager.ensure(node.uuid, () => producer.produceBindgroupFromNode({
            layouts: managers.bindgroupLayoutManager,
            buffers: managers.bufferManager,
            node
        }));
    }

    // ---- primitive-level ----

    private static buildPrimitive(node: NodeWrapper, p: PrimitiveWrapper, ctx: RenderItemBuilderContext): RenderItem {
        RenderItemBuilder.ensureShaderRebuild(p, ctx);
        RenderItemBuilder.ensureShaderCode(p, ctx);
        RenderItemBuilder.ensureGeometryBuffers(p, ctx);
        RenderItemBuilder.ensureMaterialResources(p, ctx);
        RenderItemBuilder.ensurePipelineInputs(p, ctx);
        RenderItemBuilder.ensurePipeline(p, ctx);

        const {managers, hasher, camera} = ctx;

        return {
            pipeline: managers.pipelineManager.getRaw(p.getPipeline().convertToHash(hasher)),
            bindGroups: [
                {slot: 0, bindGroup: managers.bindgroupManager.getRaw(camera.uuid)},
                {slot: 1, bindGroup: managers.bindgroupManager.getRaw(p.getMaterial().convertToBindgroupHash(hasher))},
                {slot: 2, bindGroup: managers.bindgroupManager.getRaw(node.uuid)},
            ],
            vertexBuffers: RenderItemBuilder.buildVertexBuffers(p, ctx),
            draw: RenderItemBuilder.resolveDrawInfo(p, ctx),
        };
    }

    private static ensureShaderRebuild(p: PrimitiveWrapper, ctx: RenderItemBuilderContext): void {
        const {hasher} = ctx;
        if (p.getMaterial().needsShaderRebuild(hasher) || p.getGeometry().needsShaderRebuild(hasher)) {
            p.getPipeline().markVertexShaderDirty();
            p.getPipeline().markFragmentShaderDirty();
            p.getMaterial().syncShaderRebuild();
            p.getGeometry().syncAttributesHash();
        }
    }

    private static ensureShaderCode(p: PrimitiveWrapper, ctx: RenderItemBuilderContext): void {
        const {producer, managers, hasher} = ctx;
        const vertexWrapper = p.getPipeline().getVertexShaderWrapper();
        const fragmentWrapper = p.getPipeline().getFragmentShaderWrapper();

        if (vertexWrapper.codeGenVersionFlag.needsUpdate()) {
            const entryPoint = vertexWrapper.getEntryPoint();
            const code = p.getVertexAssembler().assemble(producer.produceVertexShader({
                geometry: p.getGeometry(),
                material: p.getMaterial(),
            }), entryPoint);
            vertexWrapper.setShader(code, entryPoint);
            vertexWrapper.codeGenVersionFlag.sync();
        }

        if (fragmentWrapper.codeGenVersionFlag.needsUpdate()) {
            const entryPoint = fragmentWrapper.getEntryPoint();
            const code = p.getFragmentAssembler().assemble(producer.produceFragmentShader({
                geometry: p.getGeometry(),
                vertexShader: vertexWrapper,
                material: p.getMaterial()
            }), entryPoint);
            fragmentWrapper.setShader(code, entryPoint);
            fragmentWrapper.codeGenVersionFlag.sync();
        }

        managers.shaderModuleManager.ensure(vertexWrapper.convertToHash(hasher), () => producer.produceShaderModule(vertexWrapper));
        managers.shaderModuleManager.ensure(fragmentWrapper.convertToHash(hasher), () => producer.produceShaderModule(fragmentWrapper));
    }

    private static ensureGeometryBuffers(p: PrimitiveWrapper, ctx: RenderItemBuilderContext): void {
        const {managers, producer, hasher} = ctx;

        p.getGeometry().getAttributes().forEach(attribute => {
            managers.bufferManager.ensure(attribute.convertToHash(hasher), () => producer.produceBuffer(attribute));
        });

        const indices = p.getGeometry().getIndices();
        if (indices) {
            managers.bufferManager.ensure(indices.convertToHash(hasher), () => producer.produceBuffer(indices));
        }
    }

    private static ensureMaterialResources(p: PrimitiveWrapper, ctx: RenderItemBuilderContext): void {
        const {managers, producer, hasher} = ctx;
        const material = p.getMaterial();

        managers.bufferManager.ensure(material.convertToFactorsHash(hasher), () => producer.produceBufferFromMatFactors(material));

        material.getAllComponents().forEach(component => {
            if (component.getTexture()) {
                const sampler = component.getTexture()!.wrapper.getSampler();
                const image = component.getTexture()!.wrapper.getImage();
                managers.samplerManager.ensure(sampler.convertToHash(hasher), () => producer.produceSampler(sampler));
                managers.textureManager.ensure(image.convertToHash(hasher), () => producer.produceTexture(image));
            }

            if (component.needsFactorUpdate()) {
                const plan = producer.getFactorPlan(material);
                const item = plan.get(component.name)!;
                managers.bufferManager.upload(
                    material.convertToFactorsHash(hasher),
                    new Float32Array([item.factor].flat()),
                    item.offset
                );
                component.syncFactorUpdate();
            }
        });

        managers.bindgroupLayoutManager.ensure(material.convertToBindgroupLayoutHash(hasher), () => producer.produceBindGroupLayout(material));
        managers.bindgroupManager.ensure(material.convertToBindgroupHash(hasher), () => producer.produceBindGroup({
            material, samplers: managers.samplerManager, hasher, buffers: managers.bufferManager,
            layouts: managers.bindgroupLayoutManager, textures: managers.textureManager,
        }));
        managers.pipelineLayoutManager.ensure(material.convertToBindgroupLayoutHash(hasher), () => producer.producePipelineLayout({
            material, hasher, layouts: managers.bindgroupLayoutManager
        }));
    }

    private static ensurePipelineInputs(p: PrimitiveWrapper, ctx: RenderItemBuilderContext): void {
        const {hasher} = ctx;
        p.getPipeline().setInputs(
            p.getPipeline().getVertexShaderWrapper().convertToHash(hasher),
            p.getPipeline().getFragmentShaderWrapper().convertToHash(hasher),
            p.getMaterial().convertToBindgroupLayoutHash(hasher),
            p.getGeometry().convertToAttributesHash(hasher),
            p.getMaterial().convertToPipelineSettingsHash(hasher),
            "back" // TODO: derive from material.doubleSided per the v2 facePass-variant plan
        );
    }

    private static ensurePipeline(p: PrimitiveWrapper, ctx: RenderItemBuilderContext): void {
        const {managers, producer, hasher, frame} = ctx;
        managers.pipelineManager.ensure(p.getPipeline().convertToHash(hasher), () => producer.producePipeline({
            frame: {colorFormat: frame.colorFormat, depthFormat: frame.depthFormat},
            hasher,
            geometry: p.getGeometry(),
            material: p.getMaterial(),
            pipelineLayouts: managers.pipelineLayoutManager,
            pipeline: p.getPipeline(),
            shaderModules: managers.shaderModuleManager
        }));
    }

    private static buildVertexBuffers(p: PrimitiveWrapper, ctx: RenderItemBuilderContext) {
        const {producer, managers, hasher} = ctx;
        const attrPlan = producer.getAttributePlan(p.getGeometry());
        return attrPlan.slots.map((slot) => {
            const attr = p.getGeometry().getAttributes().get(slot.name)!;
            return {slot: slot.slot, buffer: managers.bufferManager.getRaw(attr.convertToHash(hasher))};
        });
    }

    private static resolveDrawInfo(p: PrimitiveWrapper, ctx: RenderItemBuilderContext) {
        const {producer, managers, hasher} = ctx;
        const geometry = p.getGeometry();
        const indices = geometry.getIndices();
        const attrPlan = producer.getAttributePlan(geometry);
        const positionSlot = attrPlan.slots.find(s => s.name === "position")!;

        if (indices) {
            const bytesPerIndex = indices.format === "uint32" ? 4 : 2;
            return {
                indexed: true,
                count: indices.getData().byteLength / bytesPerIndex,
                indexBuffer: managers.bufferManager.getRaw(indices.convertToHash(hasher)),
                indexFormat: indices.format as GPUIndexFormat,
            };
        }

        const position = geometry.getAttributes().get("position")!;
        return {
            indexed: false,
            count: position.getData().byteLength / positionSlot.arrayStride,
        };
    }
}