import type {Scene} from "../Scene/Scene.ts";
import {Hasher} from "../hashing/utils/Hasher.ts";
import {HashResolver} from "../hashing/utils/HashResolver.ts";
import {CentralProducer} from "../producers/CentralProducer.ts";
import type {Camera} from "../Camera/Camera.ts";
import {v4 as uuidv4} from "uuid";
import {CentralManager} from "../managers/CentralManager.ts";
import {RenderTarget} from "./RenderTarget.ts";
import {RenderItemBuilder} from "./RenderItemBuilder.ts";
import {RenderCache} from "./RenderCache.ts";
import {getEpoch} from "../hashing/utils/epoch.ts";
import {UpdateLayer} from "./UpdateLayer.ts";
import type {BufferManager} from "../managers/BufferManager.ts";


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
    private hashResolver!: HashResolver;
    private readonly producer = new CentralProducer();
    private readonly renderCache = new RenderCache();
    private _bufferUploadFunction!: BufferManager["upload"]

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

        // renderer camera
        this.managers.bufferManager.ensure(this.uuid, () => ({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: `${this.uuid} renderer camera buffer`,
            data: new Float32Array(32).buffer
        }))

        this._bufferUploadFunction = this.managers.bufferManager.upload.bind(this.managers.bufferManager)

        // scene bindgroup initialization since the only binding is camera witch is static
        this.managers.bindgroupManager.ensure(this.uuid, () => this.producer.produceSceneBindgroup({
            layouts: this.managers.bindgroupLayoutManager,
            rendererUUID: this.uuid,
            buffers: this.managers.bufferManager
        }))

        this.hasher = await Hasher.create();
        this.hashResolver = new HashResolver(this.hasher);
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

        const ctx = {
            rendererUUID: this.uuid,
            managers: this.managers,
            producer: this.producer,
            hashes: this.hashResolver,
            frame: {colorFormat: this.format, depthFormat: this.depthRenderTarget.format},
            cache: this.renderCache,
        }

        // global
        UpdateLayer.updateCamera(camera, ctx)

        scene.traverse((node) => {
            for (const item of RenderItemBuilder.build(node, ctx)) {
                pass.setPipeline(item.pipeline);
                for (const bg of item.bindGroups) {
                    pass.setBindGroup(bg.slot, bg.bindGroup)
                }
                for (const vb of item.vertexBuffers) {
                    pass.setVertexBuffer(vb.slot, vb.buffer)
                }

                if (item.draw.indexed) {
                    pass.setIndexBuffer(item.draw.indexBuffer!, item.draw.indexFormat!);
                    pass.drawIndexed(item.draw.count);
                } else {
                    pass.draw(item.draw.count);
                }
            }
        });

        scene.updateWorldMatrices(this._bufferUploadFunction);

        this.renderCache.lastFrameEpoch = getEpoch();
        pass.end();
        this.device.queue.submit([encoder.finish()]);
        this.renderCache.endFrame(ctx)
        console.log(this.managers.pipelineManager.getCacheLength())
        this.managers.endFrame()
        this.producer.clear()
    }
}