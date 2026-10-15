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
import {getWorldEpoch} from "../hashing/utils/worldEpoch.ts";
import type {SkinUpdater} from "./SkinUpdater.ts";
import type {SkinInstanceWrapper} from "../wrappers/SkinInstanceWrapper.ts";
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

    hasher!: Hasher;
    private hashResolver!: HashResolver;
    private readonly producer = new CentralProducer();
    private readonly renderCache = new RenderCache();
    private _bufferUploadFunction!: BufferManager["upload"]
    private skinUpdater?: SkinUpdater;
    private readonly frameSkins = new Set<SkinInstanceWrapper>();
    private lastWorldEpoch = -1;   // -1: the first frame always reports worldMoved

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


    /** Plug in the skinning module (LBS, DQS, ...) that writes the palette buffers each frame. */
    setSkinUpdater(updater: SkinUpdater | undefined): void {
        this.skinUpdater = updater;
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
            frameSkins: this.frameSkins,
        }
        this.frameSkins.clear()

        // global
        UpdateLayer.updateCamera(camera, ctx)

        scene.traverse((node) => {
            for (const item of RenderItemBuilder.build(node, ctx)) {
                // bind groups and buffers are shared by every variant: set once, then one setPipeline + draw per variant
                for (const bg of item.bindGroups) {
                    pass.setBindGroup(bg.slot, bg.bindGroup)
                }
                for (const vb of item.vertexBuffers) {
                    pass.setVertexBuffer(vb.slot, vb.buffer)
                }
                if (item.draw.indexed) {
                    pass.setIndexBuffer(item.draw.indexBuffer!, item.draw.indexFormat!);
                }

                for (const pipeline of item.pipelines) {
                    pass.setPipeline(pipeline);
                    if (item.draw.indexed) {
                        pass.drawIndexed(item.draw.count);
                    } else {
                        pass.draw(item.draw.count);
                    }
                }
            }
        });

        scene.updateWorldMatrices(this._bufferUploadFunction);

        // after the world pass (joint worlds are current) and the traversal (palette buffers exist), before submit
        const worldEpoch = getWorldEpoch();
        if (this.skinUpdater && this.frameSkins.size > 0) {
            this.skinUpdater.update({
                skins: this.frameSkins,
                worldMoved: worldEpoch !== this.lastWorldEpoch,
                upload: this._bufferUploadFunction,
            });
        }
        this.lastWorldEpoch = worldEpoch;

        this.renderCache.lastFrameEpoch = getEpoch();
        pass.end();
        this.device.queue.submit([encoder.finish()]);
        this.renderCache.endFrame(ctx)
        this.managers.endFrame()
        console.log(this.managers.bufferManager.getCacheLength())
        this.producer.clear()
    }
}