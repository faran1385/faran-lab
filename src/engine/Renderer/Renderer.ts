import {BufferInternal} from "../internals/BufferInternal.ts";
import {BindgroupInteractor} from "../Representations/BindgroupInteractor.ts";
import {Hasher} from "../hashing/utils/Hasher.ts";
import {CentralProducer} from "../producers/CentralProducer.ts";
import type {Camera} from "../Camera/Camera.ts";
import {v4 as uuidv4} from "uuid";
import {CentralManager} from "../managers/CentralManager.ts";
import {RenderTarget} from "./RenderTarget.ts";
import {RenderItemBuilder} from "./RenderItemBuilder.ts";
import {RenderCache} from "./RenderCache.ts";
import {getEpoch} from "../hashing/utils/epoch.ts";
import {UploadLayer} from "./UploadLayer.ts";
import {flushPreFrame} from "../Adaptors/PreFrameQueue.ts";
import type {FrameInfo, RenderContext} from "./RenderContext.ts";
import type {RenderItem} from "./RenderItem.ts";
import type {Scene} from "../Scene/Scene.ts";


/**
 * Draws a SceneInternal. Nothing in here reads a wrapper: the adapters turn wrappers into internals in the pre-frame
 * queue, and the renderer only consumes the result.
 *
 * A frame is: flush the pre-frame queue, write changed data into existing GPU resources, build/refresh the render
 * items of the nodes whose internals changed, draw every item, release what is no longer used.
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

    /** Group 0. The camera matrices are written straight into it, so it is not an adapter's business. */
    private cameraBuffer!: BufferInternal;
    private renderContext!: RenderContext;

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

        // group 0: view + projection. The renderer keeps one reference for good, so the buffer outlives frames in
        // which no node uses the scene bind group and uploads never find it missing.
        this.cameraBuffer = new BufferInternal(new Float32Array(32).buffer, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        const sceneBindgroup = new BindgroupInteractor();
        sceneBindgroup.setUniform(0, this.cameraBuffer, GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT);
        this.managers.bufferManager.ensure(this.cameraBuffer.uuid, () => this.producer.produceBuffer(this.cameraBuffer));
        this.managers.bufferManager.acquire(this.cameraBuffer.uuid);

        this.renderContext = {
            managers: this.managers,
            producer: this.producer,
            hasher: this.hasher,
            frame: this.currentFrame(),
            cache: this.renderCache,
            sceneBindgroup,
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
        // 1. wrappers -> internals, once, from the final state of everything that was set since the last frame

        const ctx = this.renderContext;

        flushPreFrame(ctx);

        // Scene membership is synchronized by the pre-frame queue; read the flattened list after it flushes.
        const sceneNodes = scene.adaptor.internal.getNodes();


        // The target formats are part of every pipeline. A change reaches every node, then every node is re-checked.
        const frame = this.currentFrame();
        if (frame.colorFormat !== ctx.frame.colorFormat || frame.depthFormat !== ctx.frame.depthFormat) {
            ctx.frame = frame;
            for (const node of sceneNodes) node.setFrame(frame);
            this.renderCache.invalidateAll();
        }

        // 2. data that changed in place goes into the GPU resources that already exist
        UploadLayer.flush(ctx);
        UploadLayer.updateCamera(camera, ctx, this.cameraBuffer.uuid);

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

        // 3. + 4. refresh the render items of changed nodes, draw every item
        for (const node of sceneNodes) {
            for (const item of RenderItemBuilder.build(node, ctx)) {
                Renderer.draw(pass, item);
            }
        }

        this.renderCache.lastFrameEpoch = getEpoch();
        pass.end();
        this.device.queue.submit([encoder.finish()]);

        // 5. nodes that left the scene release their resources, then unused resources are collected
        this.renderCache.endFrame(ctx)
        this.managers.endFrame()
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
