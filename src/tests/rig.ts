import {PerspectiveCamera} from "../engine/Camera/PerspectiveCamera.ts";
import {Scene} from "../engine/Scene/Scene.ts";
import {Renderer} from "../engine/Renderer/Renderer.ts";
import {RenderTarget} from "../engine/Renderer/RenderTarget.ts";
import {getEpoch} from "../engine/hashing/utils/epoch.ts";
import type {Hasher} from "../engine/hashing/utils/Hasher.ts";
import type {RenderContext} from "../engine/Renderer/RenderContext.ts";

/** The offscreen colour target (and the canvas) are SIZE x SIZE pixels. */
export const SIZE = 256;

/** True when this browser accepts `array<f32, N>` padding fields in uniform structs (WGSL uniform_buffer_standard_layout). */
export function supportsStandardUniformLayout(): boolean {
    return (navigator.gpu as unknown as { wgslLanguageFeatures?: Set<string> }).wgslLanguageFeatures?.has("uniform_buffer_standard_layout") ?? false;
}

/**
 * planMaterialFactors() pads uniform structs with `_paddingN: array<f32, K>`, which only compiles with the WGSL feature
 * above. Where it is missing every generated material shader fails, so the rig rewrites those fields into K plain f32
 * members (identical layout). Test-only: the engine stays untouched and browsers that need no help are not shimmed.
 */
export function patchUniformPadding(code: string): string {
    return code.replace(/(_padding\d+):\s*array<f32,\s*(\d+)>,/g, (_m, name: string, count: string) =>
        Array.from({length: Number(count)}, (_, i) => `${name}_${i}: f32,`).join(" "));
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

export type Counts = Record<ManagerName, number>;

export function emptyCounts(): Counts {
    return {
        buffer: 0, texture: 0, sampler: 0, shaderModule: 0,
        bindgroupLayout: 0, pipelineLayout: 0, bindgroup: 0, pipeline: 0,
    };
}

export function formatCounts(counts: Partial<Counts>): string {
    const parts = MANAGER_NAMES.filter((n) => (counts[n] ?? 0) !== 0).map((n) => `${n} ${counts[n]}`);
    return parts.length > 0 ? parts.join(", ") : "nothing";
}

export interface ManagerSnapshot {
    /** Every cache key currently alive. */
    keys: string[];
    /** Every tracker's refcount, sorted ascending. Two equivalent states have the same histogram. */
    refs: number[];
    /** Keys whose refcount is 0: nothing will ever release them, so they are never collected. */
    zeroRef: string[];
}

export type Snapshot = Record<ManagerName, ManagerSnapshot>;

/** Everything the rig counts, at one moment. Differences between two of them describe what a step cost. */
export interface Counters {
    created: Counts;
    bufferWrites: number;
    bufferBytes: number;
    textureWrites: number;
    hashCalls: number;
}

/** What one `rig.step()` did: GPU objects created, bytes written, hashes computed, epoch movement, frame cost. */
export interface StepResult {
    /** GPU objects the managers created during the step. */
    created: Counts;
    /** queue.writeBuffer calls / bytes (in-place uploads: node matrices, factors, camera, geometry data). */
    bufferWrites: number;
    bufferBytes: number;
    /** queue.writeTexture calls (a texture creation writes its pixels once, an in-place update writes again). */
    textureWrites: number;
    /** Calls to Hasher.hashString / hashArrayBuffer: a direct measure of how much hashing a change caused. */
    hashCalls: number;
    /** How far the global epoch moved while the mutation ran (setters that stamp immediately). */
    epochOnSet: number;
    /** How far it moved in total, mutation plus the frame(s) that followed (adapters stamp inside the frame). */
    epochBumps: number;
    /** CPU time of the first frame after the mutation. */
    frameMs: number;
}

export interface FrameTiming {
    /** Renderer.render() on the CPU: pre-frame queue, uploads, item rebuilds, encoding, submit. */
    cpuMs: number;
    /** From submit until the GPU reported the work done (includes async shader / pipeline compilation). */
    gpuMs: number;
    totalMs: number;
}

type Mgr = {
    cache: Map<string, { refs: number }>;
    build: (...args: unknown[]) => unknown;
};

interface RendererInternals {
    device: GPUDevice;
    managers: Record<string, Mgr>;
    format: GPUTextureFormat;
    hasher: Hasher;
    renderContext: RenderContext;
}

/**
 * One renderer + scene + camera on its own GPUDevice, with the instrumentation the tests need:
 *  - GPU validation / OOM / internal errors are collected (error scopes around every frame)
 *  - every GPU object a manager creates is counted (`created`), as are queue.writeBuffer / writeTexture calls
 *  - every hash the engine computes is counted (`hashCalls`)
 *  - managers' caches can be snapshotted (keys + refcounts)
 *  - frames can be timed and read back
 *
 * It reaches into the Renderer's private fields (`device`, `managers`, `renderContext`) on purpose so the engine stays
 * untouched. Frames go to an offscreen colour target instead of the canvas swapchain, so the tests also run where
 * presenting is unavailable and the result can be read back with copyTextureToBuffer.
 *
 * By default it draws `scene` (a wrapper Scene). Set `custom` to draw another Scene wrapper.
 */
export class Rig {
    /** The canvas on the test page that shows the last frame that was read back (the renderer's own canvas is never attached). */
    readonly canvas: HTMLCanvasElement;
    readonly renderer: Renderer;
    readonly scene = new Scene();
    /** Replaceable: tests swap the camera to check what a different camera costs. */
    camera: PerspectiveCamera;
    readonly device: GPUDevice;
    readonly format: GPUTextureFormat;
    readonly hasher: Hasher;
    /** When set, this is drawn instead of `scene`. */
    custom: Scene | null = null;

    private readonly created: Counts = emptyCounts();
    private bufferWrites = 0;
    private bufferBytes = 0;
    private textureWrites = 0;
    private hashCalls = 0;
    private gpuErrors: string[] = [];

    /** Snapshot of an empty scene: the renderer's own resources (the camera buffer). */
    baseline!: Snapshot;

    private readonly internals: RendererInternals;
    private readonly view: CanvasRenderingContext2D;
    private readonly managers: Record<ManagerName, Mgr>;
    private readonly target: GPUTexture;
    private readonly bgra: boolean;

    /** Whether generated WGSL is being rewritten for this rig (see patchUniformPadding). */
    shimmed = false;

    private constructor(view: HTMLCanvasElement, renderer: Renderer) {
        this.canvas = view;
        this.renderer = renderer;
        const internals = renderer as unknown as RendererInternals;
        this.internals = internals;
        this.device = internals.device;
        this.format = internals.format;
        this.hasher = internals.hasher;

        // Offscreen colour target the renderer draws into; it must be readable, which RenderTarget does not allow.
        this.bgra = internals.format.startsWith("bgra");
        this.target = this.device.createTexture({
            size: [SIZE, SIZE],
            format: internals.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
        });
        this.useReadableTarget();

        this.camera = new PerspectiveCamera(45, 1, 0.1, 100);
        this.camera.setPosition(0, 0, 8);

        this.view = view.getContext("2d")!;

        if (!supportsStandardUniformLayout()) {
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

        const queue = this.device.queue as unknown as { writeBuffer: (...a: unknown[]) => void; writeTexture: (...a: unknown[]) => void };
        const writeBuffer = queue.writeBuffer.bind(queue);
        queue.writeBuffer = (...args: unknown[]) => {
            this.bufferWrites++;
            this.bufferBytes += (args[2] as { byteLength: number }).byteLength;
            writeBuffer(...args);
        };
        const writeTexture = queue.writeTexture.bind(queue);
        queue.writeTexture = (...args: unknown[]) => {
            this.textureWrites++;
            writeTexture(...args);
        };

        const hasher = this.hasher as unknown as {
            hashString: (s: string) => string;
            hashArrayBuffer: (b: ArrayBuffer) => string;
        };
        const hashString = hasher.hashString.bind(hasher);
        hasher.hashString = (s: string) => {
            this.hashCalls++;
            return hashString(s);
        };
        const hashArrayBuffer = hasher.hashArrayBuffer.bind(hasher);
        hasher.hashArrayBuffer = (b: ArrayBuffer) => {
            this.hashCalls++;
            return hashArrayBuffer(b);
        };

        this.device.addEventListener("uncapturederror", (e) => {
            this.gpuErrors.push(`uncaptured: ${(e as GPUUncapturedErrorEvent).error.message}`);
        });
        void this.device.lost.then((info) => {
            if (info.reason !== "destroyed") this.gpuErrors.push(`device lost: ${info.message}`);
        });
    }

    static async create(host: HTMLElement): Promise<Rig> {
        // The renderer needs a canvas for its WebGPU context, but it never presents to it (see above).
        // It must already have its final size: the depth target is created from it in init().
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

        const rig = new Rig(view, renderer);
        await rig.render(2);
        rig.baseline = rig.snapshot();
        rig.resetCounters();
        rig.takeGpuErrors();
        return rig;
    }

    dispose(): void {
        this.device.destroy();
        this.canvas.remove();
    }

    // -- render targets -----------------------------------------------------------------------------------------

    /** The target the readback reads: same format as the swapchain, readable. */
    private useReadableTarget(): void {
        const target = new RenderTarget(SIZE, SIZE, {format: this.internals.format});
        (target as unknown as { texture: GPUTexture }).texture = this.target;
        this.renderer.colorRenderTarget = target;
    }

    /** Switches the colour target to another format: every pipeline has to be rebuilt. Not readable. */
    swapColorTargetFormat(): GPUTextureFormat {
        const format: GPUTextureFormat = this.format === "bgra8unorm" ? "rgba8unorm" : "bgra8unorm";
        this.renderer.colorRenderTarget = new RenderTarget(SIZE, SIZE, {format});
        return format;
    }

    restoreColorTarget(): void {
        this.useReadableTarget();
    }

    /** What the renderer hands to the render layers. Tests use it to build pipelines by hand. */
    get context(): RenderContext {
        return this.internals.renderContext;
    }

    /** The frame info the renderer hands to every pipeline (formats of the targets currently in use). */
    get frameInfo() {
        return this.internals.renderContext.frame;
    }

    // -- counters -----------------------------------------------------------------------------------------------

    counters(): Counters {
        return {
            created: {...this.created},
            bufferWrites: this.bufferWrites,
            bufferBytes: this.bufferBytes,
            textureWrites: this.textureWrites,
            hashCalls: this.hashCalls,
        };
    }

    resetCounters(): void {
        for (const name of MANAGER_NAMES) this.created[name] = 0;
        this.bufferWrites = 0;
        this.bufferBytes = 0;
        this.textureWrites = 0;
        this.hashCalls = 0;
    }

    takeGpuErrors(): string[] {
        const errors = this.gpuErrors;
        this.gpuErrors = [];
        return errors;
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
        return [(clip[0] / clip[3] * 0.5 + 0.5) * SIZE, (1 - (clip[1] / clip[3] * 0.5 + 0.5)) * SIZE];
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

    /** Live resources per manager, the renderer's own (baseline) ones included. */
    alive(): Counts {
        const out = emptyCounts();
        for (const name of MANAGER_NAMES) out[name] = this.managers[name].cache.size;
        return out;
    }

    /** Live resources per manager that the scene is responsible for: `alive()` minus the empty-scene baseline. */
    addedSinceBaseline(): Counts {
        const out = emptyCounts();
        for (const name of MANAGER_NAMES) out[name] = this.managers[name].cache.size - this.baseline[name].keys.length;
        return out;
    }

    // -- frames -------------------------------------------------------------------------------------------------

    /** Render `frames` frames and wait until the GPU has processed them, collecting GPU errors. */
    async render(frames = 1): Promise<void> {
        await this.scoped(() => {
            for (let i = 0; i < frames; i++) this.frame();
        });
    }

    /**
     * Runs `mutate`, renders `frames` frames and reports what that cost. This is the unit every change-trigger test
     * is built from: "I changed X, what did the engine have to do?".
     */
    async step(mutate: () => void, frames = 1): Promise<StepResult> {
        const before = this.counters();
        const epoch0 = getEpoch();
        mutate();
        const epochOnSet = getEpoch() - epoch0;

        let frameMs = 0;
        await this.scoped(() => {
            for (let i = 0; i < frames; i++) {
                const start = performance.now();
                this.frame();
                if (i === 0) frameMs = performance.now() - start;
            }
        });

        const after = this.counters();
        const created = emptyCounts();
        for (const name of MANAGER_NAMES) created[name] = after.created[name] - before.created[name];
        return {
            created,
            bufferWrites: after.bufferWrites - before.bufferWrites,
            bufferBytes: after.bufferBytes - before.bufferBytes,
            textureWrites: after.textureWrites - before.textureWrites,
            hashCalls: after.hashCalls - before.hashCalls,
            epochOnSet,
            epochBumps: getEpoch() - epoch0,
            frameMs,
        };
    }

    /** One frame, timed: CPU cost of render() and the wait until the GPU is done with it. */
    async timedFrame(): Promise<FrameTiming> {
        let cpuMs = 0;
        let gpuMs = 0;
        await this.scoped(async () => {
            const start = performance.now();
            this.frame();
            const submitted = performance.now();
            cpuMs = submitted - start;
            await this.device.queue.onSubmittedWorkDone();
            gpuMs = performance.now() - submitted;
        });
        return {cpuMs, gpuMs, totalMs: cpuMs + gpuMs};
    }

    /**
     * `count` frames back to back. Returns the CPU cost of every render() call plus how long the GPU needed to drain
     * the whole batch afterwards. `between` runs before each frame (an animation tick).
     */
    async timedFrames(count: number, between?: (index: number) => void): Promise<{ cpu: number[]; drainMs: number }> {
        const cpu: number[] = [];
        let drainMs = 0;
        await this.scoped(async () => {
            for (let i = 0; i < count; i++) {
                between?.(i);
                const start = performance.now();
                this.frame();
                cpu.push(performance.now() - start);
            }
            const submitted = performance.now();
            await this.device.queue.onSubmittedWorkDone();
            drainMs = performance.now() - submitted;
        });
        return {cpu, drainMs};
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

    private frame(): void {
        // The engine console.logs from inside the render path (ResourceLayer.pipeline). Keep the console usable for the
        // timing lines the tests print: those run outside of this window.
        const log = console.log;
        console.log = () => {
        };
        try {
            this.renderer.render(this.custom ?? this.scene, this.camera);
        } finally {
            console.log = log;
        }
    }

    private async scoped(fn: () => void | Promise<void>): Promise<void> {
        const d = this.device;
        d.pushErrorScope("validation");
        d.pushErrorScope("out-of-memory");
        d.pushErrorScope("internal");

        let thrown: unknown;
        let didThrow = false;
        try {
            await fn();
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

/** Pixel helpers for the few scenarios that read the frame back. */
export function pixelAt(pixels: Uint8ClampedArray, x: number, y: number): [number, number, number, number] {
    const i = (y * SIZE + x) * 4;
    return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
}

/** Share of pixels that are not the clear colour (black). */
export function coverage(pixels: Uint8ClampedArray): number {
    let lit = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 4 || pixels[i + 1] > 4 || pixels[i + 2] > 4) lit++;
    }
    return lit / (pixels.length / 4);
}
