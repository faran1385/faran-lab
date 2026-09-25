import type {Scene} from "../Scene/Scene.ts";
import {Hasher} from "../hashing/Hasher.ts";
import {DescriptorProducer} from "../producers/CentralProducer.ts";
import type {Camera} from "../Camera/Camera.ts";
import {v4 as uuidv4} from "uuid";
import {CentralManager} from "../managers/CentralManager.ts";
import {RenderTarget} from "./RenderTarget.ts";


export class Renderer {
    private device!: GPUDevice;
    private ctx!: GPUCanvasContext;
    readonly uuid: string;

    private canvas: HTMLCanvasElement;
    private format!: GPUTextureFormat;

    private managers!: CentralManager;

    colorRenderTarget: RenderTarget | null = null;
    depthRenderTarget!: RenderTarget;

    private hasher!: Hasher;
    private readonly producer = new DescriptorProducer();

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.uuid = uuidv4();
    }

    async init(): Promise<void> {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error("no GPUAdapter available");

        this.device = await adapter.requestDevice();

        this.ctx = this.canvas.getContext("webgpu")!;
        this.format = navigator.gpu.getPreferredCanvasFormat();
        this.ctx.configure({device: this.device, format: this.format, alphaMode: "opaque"});
        this.managers = new CentralManager(this.device);
        this.depthRenderTarget = new RenderTarget(this.canvas.width, this.canvas.height, {
            format: "depth32float",
        })

        this.hasher = await Hasher.create();
    }

    setSize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
        this.colorRenderTarget?.setSize(width, height);
        this.depthRenderTarget.setSize(width, height);
    }

    render(scene: Scene, camera: Camera): void {
        this.colorRenderTarget?.ensureTexture(this.device)
        this.depthRenderTarget?.ensureTexture(this.device)

        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.colorRenderTarget ? this.colorRenderTarget.getTexture()!.createView() : this.ctx.getCurrentTexture().createView(),
                    loadOp: "clear",
                    clearValue: [0, 0, 0, 1],
                    storeOp: "store",
                },
            ],
            depthStencilAttachment: {
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 1,
                view: this.depthRenderTarget.getTexture()!.createView()
            }
        });

        // global
        this.managers.bufferManager.ensure(camera.uuid, () => this.producer.produceCameraBuffer(camera))
        if (camera.isUploadViewDirty()) {
            this.managers.bufferManager.upload(camera.uuid, camera.getViewMatrix().buffer, 0)
            camera.syncUploadView()
        }
        if (camera.isUploadProjectionDirty()) {
            this.managers.bufferManager.upload(camera.uuid, camera.getProjectionMatrix().buffer, 64)
            camera.syncUploadProjection()
        }
        // hash should change as we add items
        this.managers.bindgroupManager.ensure(camera.uuid, () => this.producer.produceSceneBindgroup({
            layouts: this.managers.bindgroupLayoutManager,
            camera,
            buffers: this.managers.bufferManager
        }))


        scene.traverse((node) => {
            this.managers.bufferManager.ensure(node.uuid, () => this.producer.produceBufferFromNodeMatrix(node));
            this.managers.bindgroupManager.ensure(node.uuid, () => this.producer.produceBindgroupFromNode({
                layouts: this.managers.bindgroupLayoutManager,
                buffers: this.managers.bufferManager,
                node
            }));
        })

        scene.updateWorldMatrices(this.managers.bufferManager.upload.bind(this.managers.bufferManager));

        scene.traverse((node) => {

            if (node.getMesh()) {
                node.getMesh()!.getAllPrimitives().forEach((p) => {
                    if (p.getMaterial().needsShaderRebuild(this.hasher)) {
                        p.getPipeline().markVertexShaderDirty()
                        p.getPipeline().markFragmentShaderDirty()
                        p.getMaterial().syncShaderRebuild()
                    }

                    if (p.getPipeline().getVertexShaderWrapper().codeGenVersionFlag.needsUpdate()) {
                        const entryPoint = "main"
                        const code = p.getVertexAssembler().assemble(this.producer.produceVertexShader({
                            geometry: p.getGeometry(),
                            material: p.getMaterial(),
                        }), entryPoint)
                        p.getPipeline().getVertexShaderWrapper().setShader(code, entryPoint)
                        p.getPipeline().getVertexShaderWrapper().codeGenVersionFlag.sync()
                    }

                    if (p.getPipeline().getFragmentShaderWrapper().codeGenVersionFlag.needsUpdate()) {
                        const entryPoint = "main"
                        const code = p.getFragmentAssembler().assemble(this.producer.produceFragmentShader({
                            geometry: p.getGeometry(),
                            vertexShader: p.getPipeline().getVertexShaderWrapper(),
                            material: p.getMaterial()
                        }), entryPoint)
                        p.getPipeline().getFragmentShaderWrapper().setShader(code, entryPoint)
                        p.getPipeline().getFragmentShaderWrapper().codeGenVersionFlag.sync()
                    }
                    p.getGeometry().getAttributes().forEach(attribute => {
                        this.managers.bufferManager.ensure(attribute.convertToHash(this.hasher), () => this.producer.produceBuffer(attribute))
                    })

                    this.managers.bufferManager.ensure(p.getMaterial().convertToFactorsHash(this.hasher), () => this.producer.produceBufferFromMatFactors(p.getMaterial()))
                    this.managers.shaderModuleManager.ensure(p.getPipeline().getVertexShaderWrapper().convertToHash(this.hasher), () => this.producer.produceShaderModule(p.getPipeline().getVertexShaderWrapper()))
                    this.managers.shaderModuleManager.ensure(p.getPipeline().getFragmentShaderWrapper().convertToHash(this.hasher), () => this.producer.produceShaderModule(p.getPipeline().getFragmentShaderWrapper()))

                    p.getMaterial().getAllComponents().forEach(component => {

                        if (component.getTexture()) {
                            this.managers.samplerManager.ensure(component.getTexture()!.wrapper.getSampler().convertToHash(this.hasher), () => this.producer.produceSampler(component.getTexture()!.wrapper.getSampler()))
                            this.managers.textureManager.ensure(component.getTexture()!.wrapper.getImage().convertToHash(this.hasher), () => this.producer.produceTexture(component.getTexture()!.wrapper.getImage()))
                        }

                        if (component.needsFactorUpdate()) {
                            const plan = this.producer.getFactorPlan(p.getMaterial())
                            const item = plan.get(component.name)!

                            this.managers.bufferManager.upload(p.getMaterial().convertToFactorsHash(this.hasher), new Float32Array([item.factor].flat()), item.offset)
                            component.syncFactorUpdate()
                        }
                    })

                    this.managers.bindgroupLayoutManager.ensure(p.getMaterial().convertToBindgroupLayoutHash(this.hasher), () => this.producer.produceBindGroupLayout(p.getMaterial()))
                    this.managers.bindgroupManager.ensure(p.getMaterial().convertToBindgroupHash(this.hasher), () => this.producer.produceBindGroup({
                        material: p.getMaterial(),
                        samplers: this.managers.samplerManager,
                        hasher: this.hasher,
                        buffers: this.managers.bufferManager,
                        layouts: this.managers.bindgroupLayoutManager,
                        textures: this.managers.textureManager,
                    }))
                    this.managers.pipelineLayoutManager.ensure(p.getMaterial().convertToBindgroupLayoutHash(this.hasher), () => this.producer.producePipelineLayout({
                        material: p.getMaterial(),
                        hasher: this.hasher,
                        layouts: this.managers.bindgroupLayoutManager
                    }))
                    p.getPipeline().setInputs(
                        p.getPipeline().getVertexShaderWrapper().convertToHash(this.hasher),
                        p.getPipeline().getFragmentShaderWrapper().convertToHash(this.hasher),
                        p.getMaterial().convertToBindgroupLayoutHash(this.hasher),
                        p.getGeometry().convertToAttributesHash(this.hasher),
                        p.getMaterial().convertToPipelineSettingsHash(this.hasher),
                        "back"
                    )
                    this.managers.pipelineManager.ensure(p.getPipeline().convertToHash(this.hasher), () => this.producer.producePipeline({
                        frame: {
                            colorFormat: this.format,
                            depthFormat: this.depthRenderTarget.format
                        },
                        hasher: this.hasher,
                        geometry: p.getGeometry(),
                        material: p.getMaterial(),
                        pipelineLayouts: this.managers.pipelineLayoutManager,
                        pipeline: p.getPipeline(),
                        shaderModules: this.managers.shaderModuleManager
                    }))

                    pass.setPipeline(this.managers.pipelineManager.getRaw(p.getPipeline().convertToHash(this.hasher)))
                    pass.setBindGroup(0, this.managers.bindgroupManager.getRaw(camera.uuid))
                    pass.setBindGroup(1, this.managers.bindgroupManager.getRaw(p.getMaterial().convertToBindgroupHash(this.hasher)))
                    pass.setBindGroup(2, this.managers.bindgroupManager.getRaw(node.uuid))

                    const attrPlan = this.producer.getAttributePlan(p.getGeometry())
                    attrPlan.slots.forEach((i) => {
                        const attr = p.getGeometry().getAttributes().get(i.name)!
                        pass.setVertexBuffer(i.slot, this.managers.bufferManager.getRaw(attr.convertToHash(this.hasher)))
                    })

                    pass.draw(3)
                })

            }
        })

        pass.end();
        this.device.queue.submit([encoder.finish()]);

        this.producer.clear()
    }
}