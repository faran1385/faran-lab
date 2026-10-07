import {PerspectiveCamera} from "../engine/Camera/PerspectiveCamera.ts";
import {Scene} from "../engine/Scene/Scene.ts";
import {Renderer} from "../engine/Renderer/Renderer.ts";
import {RenderTarget} from "../engine/Renderer/RenderTarget.ts";
import type {ImageWrapper} from "../engine/wrappers/ImageWrapper.ts";

/** Canvas is SIZE x SIZE pixels. */
export const SIZE = 256;

/** True when this browser accepts `array<f32, N>` padding fields in uniform structs (WGSL uniform_buffer_standard_layout). */
export function supportsStandardUniformLayout(): boolean {
    return (navigator.gpu as unknown as { wgslLanguageFeatures?: Set<string> }).wgslLanguageFeatures?.has("uniform_buffer_standard_layout") ?? false;
}

/**
 * planMaterialFactors() pads uniform structs with `_paddingN: array<f32, K>`, which only compiles with the WGSL
 * feature above. Where it is missing every material shader fails, so the rig can rewrite those fields into K plain f32
 * members (identical layout). Test-only: it keeps the engine untouched and is skipped on browsers that need no help.
 */
export function patchUniformPadding(code: string): string {
    return code.replace(/(_padding\d+):\s*array<f32,\s*(\d+)>,/g, (_m, name: string, count: string) =>
        Array.from({length: Number(count)}, (_, i) => `${name}_${i}: f32,`).join(" "));
}

export interface RigOptions {
    /** Rewrite array padding in generated shaders when the browser cannot compile it. Default: true. */
    shimUniformPadding?: boolean;
}

/** The renderer's managers, by the short name used in reports. */
export const MANAGERS = {
    buffer: "bufferManager",
    texture: "textureManager",
    sampler: "samplerManager",
    shaderModule: "shaderModuleManager",
    bindgroupLayout: "bindgroupLayoutManager",
    pipelineLayout: "pipelineLayoutManager",
    bindgroup: "bindgroupManager",
    pipeline: "pipelineManager",
} as const;

export type ManagerName = keyof typeof MANAGERS;
export const MANAGER_NAMES = Object.keys(MANAGERS) as ManagerName[];

export interface ManagerSnapshot {
    /** Every cache key currently alive. */
    keys: string[];
    /** Every tracker's refcount, sorted ascending. Two equivalent states have the same histogram. */
    refs: number[];
    /** Keys whose refcount is 0: nothing will ever release them, so they are never collected. */
    zeroRef: string[];
}

export type Snapshot = Record<ManagerName, ManagerSnapshot>;
export type Counts = Record<ManagerName, number>;

function emptyCounts(): Counts {
    return {
        buffer: 0, texture: 0, sampler: 0, shaderModule: 0,
        bindgroupLayout: 0, pipelineLayout: 0, bindgroup: 0, pipeline: 0,
    };
}

type Mgr = {
    cache: Map<string, { refs: number }>;
    build: (...args: unknown[]) => unknown;
    upload?: (hash: string, descriptor: unknown) => void;
};

interface RendererInternals {
    device: GPUDevice;
    managers: Record<string, Mgr>;
    format: GPUTextureFormat;
    hashResolver: { resolveImage(image: ImageWrapper): string };
    producer: { produceTextureUpdate(image: ImageWrapper): unknown };
}

/**
 * One renderer + scene + camera on its own GPUDevice, with the instrumentation the tests need:
 *  - GPU validation / OOM / internal errors are collected (error scopes around every frame)
 *  - every GPU object a manager creates is counted (`created`)
 *  - managers' caches can be snapshotted (keys + refcounts)
 *  - the canvas can be read back
 *
 * It reaches into the Renderer's private fields (`device`, `managers`, `format`) on purpose so the engine stays
 * untouched. Frames go to an offscreen colour target (Renderer.colorRenderTarget) instead of the canvas swapchain, so
 * the tests also run where presenting is unavailable (headless software WebGPU) and can be read back with
 * copyTextureToBuffer.
 */
export class Rig {
    readonly canvas: HTMLCanvasElement;
    readonly renderer: Renderer;
    readonly scene = new Scene();
    readonly camera: PerspectiveCamera;
    readonly device: GPUDevice;
    readonly created: Counts = emptyCounts();
    gpuErrors: string[] = [];
    /** Snapshot of an empty scene: the renderer's own resources (camera buffer, scene bind group, static layouts). */
    baseline!: Snapshot;

    private readonly internals: RendererInternals;
    private readonly view: CanvasRenderingContext2D;
    private readonly managers: Record<ManagerName, Mgr>;
    private readonly target: GPUTexture;
    private readonly bgra: boolean;

    /** Whether generated WGSL is being rewritten for this rig (see patchUniformPadding). */
    shimmed = false;

    private constructor(view: HTMLCanvasElement, renderer: Renderer, options: RigOptions) {
        this.canvas = view;
        this.renderer = renderer;
        const internals = renderer as unknown as RendererInternals;
        this.internals = internals;
        this.device = internals.device;

        // Offscreen colour target the renderer draws into; it must be readable, which RenderTarget does not allow.
        this.bgra = internals.format.startsWith("bgra");
        this.target = this.device.createTexture({
            size: [SIZE, SIZE],
            format: internals.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
        });
        const target = new RenderTarget(SIZE, SIZE, {format: internals.format});
        (target as unknown as { texture: GPUTexture }).texture = this.target;
        renderer.colorRenderTarget = target;

        this.camera = new PerspectiveCamera(45, 1, 0.1, 100);
        this.camera.setPosition(0, 0, 8);

        this.view = view.getContext("2d")!;

        if ((options.shimUniformPadding ?? true) && !supportsStandardUniformLayout()) {
            const create = this.device.createShaderModule.bind(this.device);
            this.device.createShaderModule = (descriptor: GPUShaderModuleDescriptor) =>
                create({...descriptor, code: patchUniformPadding(descriptor.code)});
            this.shimmed = true;
        }

        const managers = {} as Record<ManagerName, Mgr>;
        for (const name of MANAGER_NAMES) {
            const mgr = internals.managers[MANAGERS[name]];
            const original = mgr.build.bind(mgr);
            mgr.build = (...args: unknown[]) => {
                this.created[name]++;
                return original(...args);
            };
            managers[name] = mgr;
        }
        this.managers = managers;

        this.device.addEventListener("uncapturederror", (e) => {
            this.gpuErrors.push(`uncaptured: ${(e as GPUUncapturedErrorEvent).error.message}`);
        });
        void this.device.lost.then((info) => {
            if (info.reason !== "destroyed") this.gpuErrors.push(`device lost: ${info.message}`);
        });
    }

    static async create(host: HTMLElement, options: RigOptions = {}): Promise<Rig> {
        // The renderer needs a canvas for its WebGPU context, but it never presents to it (see above).
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        // What the user sees on the test page: the last frame that was read back.
        const view = document.createElement("canvas");
        view.width = SIZE;
        view.height = SIZE;
        host.appendChild(view);

        const renderer = new Renderer(canvas);
        await renderer.init();
        renderer.setSize(SIZE, SIZE);

        const rig = new Rig(view, renderer, options);
        await rig.render(2);
        rig.baseline = rig.snapshot();
        rig.resetCreated();
        rig.takeGpuErrors();
        return rig;
    }

    dispose(): void {
        this.device.destroy();
        this.canvas.remove();
    }


    resetCreated(): void {
        for (const name of MANAGER_NAMES) this.created[name] = 0;
    }

    takeGpuErrors(): string[] {
        const errors = this.gpuErrors;
        this.gpuErrors = [];
        return errors;
    }

    /** Render `frames` frames and wait until the GPU has processed them, collecting GPU errors. */
    async render(frames = 1): Promise<void> {
        await this.scoped(() => {
            for (let i = 0; i < frames; i++) this.frame();
        });
    }

    /** Render one frame and return its pixels (RGBA, SIZE x SIZE). */
    async readPixels(): Promise<Uint8ClampedArray> {
        const buffer = this.device.createBuffer({size: SIZE * SIZE * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST});
        await this.scoped(() => {
            this.frame();
            const encoder = this.device.createCommandEncoder();
            encoder.copyTextureToBuffer({texture: this.target}, {buffer, bytesPerRow: SIZE * 4}, [SIZE, SIZE]);
            this.device.queue.submit([encoder.finish()]);
        });
        await buffer.mapAsync(GPUMapMode.READ);
        const pixels = new Uint8ClampedArray(buffer.getMappedRange().slice(0));
        buffer.unmap();
        buffer.destroy();

        if (this.bgra) {
            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i];
                pixels[i] = pixels[i + 2];
                pixels[i + 2] = r;
            }
        }
        this.view.putImageData(new ImageData(pixels, SIZE, SIZE), 0, 0);
        return pixels;
    }

    /**
     * Write each image's pixels into its GPU texture again (when that texture is alive). The engine only uploads
     * pixels while an image's needsUpdate flag is set, so a texture that was evicted and re-created stays blank;
     * the tests use this to look past that bug (see the texture-evict-recreate scenario).
     */
    reuploadTextures(images: Iterable<ImageWrapper>): void {
        const textures = this.managers.texture;
        for (const image of images) {
            const key = this.internals.hashResolver.resolveImage(image);
            if (textures.cache.has(key)) textures.upload!(key, this.internals.producer.produceTextureUpdate(image));
        }
    }

    /** World position -> pixel coordinates, using the camera's own matrices (column-major). */
    project(x: number, y: number, z: number): [number, number] {
        const v = this.camera.getViewMatrix();
        const p = this.camera.getProjectionMatrix();
        const mulVec = (m: Float32Array, a: number[]) => {
            const out = [0, 0, 0, 0];
            for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) out[i] += m[j * 4 + i] * a[j];
            return out;
        };
        const clip = mulVec(p, mulVec(v, [x, y, z, 1]));
        const ndcX = clip[0] / clip[3];
        const ndcY = clip[1] / clip[3];
        return [(ndcX * 0.5 + 0.5) * SIZE, (1 - (ndcY * 0.5 + 0.5)) * SIZE];
    }

    snapshot(): Snapshot {
        const out = {} as Snapshot;
        for (const name of MANAGER_NAMES) {
            const cache = this.managers[name].cache;
            const keys: string[] = [];
            const refs: number[] = [];
            const zeroRef: string[] = [];
            for (const [key, tracker] of cache) {
                keys.push(key);
                refs.push(tracker.refs);
                if (tracker.refs === 0) zeroRef.push(key);
            }
            refs.sort((a, b) => a - b);
            out[name] = {keys, refs, zeroRef};
        }
        return out;
    }

    private frame(): void {
        // Renderer.render() console.logs the pipeline cache size every frame; keep the console usable.
        const log = console.log;
        console.log = () => {
        };
        try {
            this.renderer.render(this.scene, this.camera);
        } finally {
            console.log = log;
        }
    }

    private async scoped(fn: () => void): Promise<void> {
        const d = this.device;
        d.pushErrorScope("validation");
        d.pushErrorScope("out-of-memory");
        d.pushErrorScope("internal");

        let thrown: unknown;
        let didThrow = false;
        try {
            fn();
        } catch (e) {
            didThrow = true;
            thrown = e;
        }

        const internal = await d.popErrorScope();
        const oom = await d.popErrorScope();
        const validation = await d.popErrorScope();
        if (validation) this.gpuErrors.push(`validation: ${validation.message}`);
        if (oom) this.gpuErrors.push(`out-of-memory: ${oom.message}`);
        if (internal) this.gpuErrors.push(`internal: ${internal.message}`);

        if (didThrow) throw thrown;
    }
}
