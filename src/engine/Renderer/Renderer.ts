import type {Scene} from "../Scene/Scene.ts";
import {Hasher} from "../hashing/Hasher.ts";
import {CentralProducer} from "../producers/CentralProducer.ts";
import type {Camera} from "../Camera/Camera.ts";
import {v4 as uuidv4} from "uuid";
import {CentralManager} from "../managers/CentralManager.ts";
import {RenderTarget} from "./RenderTarget.ts";
import {RenderItemBuilder} from "./RenderItemBuilder.ts";


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
    private readonly producer = new CentralProducer();

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
            RenderItemBuilder.build(node, {
                managers: this.managers,
                producer: this.producer,
                hasher: this.hasher,
                frame: {colorFormat: this.format, depthFormat: this.depthRenderTarget.format},
                camera,
            }).forEach((item) => {
                pass.setPipeline(item.pipeline);
                item.bindGroups.forEach(bg => pass.setBindGroup(bg.slot, bg.bindGroup));
                item.vertexBuffers.forEach(vb => pass.setVertexBuffer(vb.slot, vb.buffer));

                if (item.draw.indexed) {
                    pass.setIndexBuffer(item.draw.indexBuffer!, item.draw.indexFormat!);
                    pass.drawIndexed(item.draw.count);
                } else {
                    pass.draw(item.draw.count);
                }
            });
        });

        pass.end();
        this.device.queue.submit([encoder.finish()]);

        this.producer.clear()
    }
}