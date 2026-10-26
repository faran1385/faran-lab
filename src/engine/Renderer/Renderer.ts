import {Hasher} from "../hashing/utils/Hasher.ts";
import {CentralProducer} from "../producers/CentralProducer.ts";
import {CentralManager} from "../managers/CentralManager.ts";
import {RenderTarget} from "./RenderTarget.ts";
import {RenderItemBuilder} from "./RenderItemBuilder.ts";
import {RenderCache} from "./RenderCache.ts";
import {v4 as uuidv4} from "uuid";
import {getEpoch} from "../hashing/utils/epoch.ts";
import {UploadLayer} from "./UploadLayer.ts";
import {flushPreFrame} from "../Adaptors/PreFrameQueue.ts";
import {BindgroupInteractor} from "../Representations/BindgroupInteractor.ts";
import type {FrameInfo, RenderContext} from "./RenderContext.ts";
import type {RenderItem} from "./RenderItem.ts";
import type {Scene} from "../Scene/Scene.ts";
import type {Camera} from "../Camera/Camera.ts";

/**
 * Draws a Scene. The scene adapter turns wrappers into internals in the pre-frame queue, and the renderer only consumes
 * the result. Camera matrix data belongs to the Camera; this renderer only ensures its buffer has a GPU allocation.
 */
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
    private readonly producer = new CentralProducer();
    private readonly renderCache = new RenderCache();
    private renderContext!: RenderContext;
    private activeCameraBufferKey: string | null = null;

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
        });

        this.hasher = await Hasher.create();

        this.renderContext = {
            managers: this.managers,
            producer: this.producer,
            hasher: this.hasher,
            frame: this.currentFrame(),
            cache: this.renderCache,
            sceneBindgroup: new BindgroupInteractor(),
        };
    }

    setSize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
        this.colorRenderTarget?.setSize(width, height);
        this.depthRenderTarget.setSize(width, height);
    }

    private currentFrame(): FrameInfo {
        return {
            colorFormat: this.colorRenderTarget ? this.colorRenderTarget.format : this.format,
            depthFormat: this.depthRenderTarget.format,
        };
    }

    render(scene: Scene, camera: Camera): void {
        const ctx = this.renderContext;

        camera.updateBuffer();
        const cameraBuffer = camera.getBuffer();
        const cameraBufferKey = cameraBuffer.hashProvider.convertToHash();
        if (cameraBufferKey !== this.activeCameraBufferKey) {
            this.managers.bufferManager.ensure(cameraBufferKey, () => this.producer.produceBuffer(cameraBuffer));
            this.managers.bufferManager.acquire(cameraBufferKey);
            if (this.activeCameraBufferKey !== null) this.managers.bufferManager.release(this.activeCameraBufferKey);
            this.activeCameraBufferKey = cameraBufferKey;
        }
        ctx.sceneBindgroup.setUniform(0, cameraBuffer, GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT);

        flushPreFrame(ctx);

        const sceneNodes = scene.adaptor.internal.getNodes();

        const frame = this.currentFrame();
        if (frame.colorFormat !== ctx.frame.colorFormat || frame.depthFormat !== ctx.frame.depthFormat) {
            ctx.frame = frame;
            for (const node of sceneNodes) node.setFrame(frame);
            this.renderCache.invalidateAll();
        }

        UploadLayer.flush(ctx);

        this.colorRenderTarget?.ensureTexture(this.device);
        this.depthRenderTarget?.ensureTexture(this.device);
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

        for (const node of sceneNodes) {
            for (const item of RenderItemBuilder.build(node, ctx)) {
                Renderer.draw(pass, item);
            }
        }

        this.renderCache.lastFrameEpoch = getEpoch();
        pass.end();
        this.device.queue.submit([encoder.finish()]);

        this.renderCache.endFrame(ctx);
        this.managers.endFrame();
    }

    /** Bind groups and buffers are shared by every variant: set once, then one setPipeline + draw per variant. */
    private static draw(pass: GPURenderPassEncoder, item: RenderItem): void {
        for (const bg of item.bindGroups) pass.setBindGroup(bg.slot, bg.bindGroup);
        for (const vb of item.vertexBuffers) pass.setVertexBuffer(vb.slot, vb.buffer);

        const draw = item.draw;
        if (draw.indexed) pass.setIndexBuffer(draw.indexBuffer, draw.indexFormat);

        for (const pipeline of item.pipelines) {
            pass.setPipeline(pipeline);
            if (draw.indexed) {
                pass.drawIndexed(draw.indexCount, draw.instanceCount, draw.firstIndex, draw.baseVertex, draw.firstInstance);
            } else {
                pass.draw(draw.vertexCount, draw.instanceCount, draw.firstVertex, draw.firstInstance);
            }
        }
    }
}
