/**
 *
 * Single responsibility: turn a <canvas> into a configured, resize-aware
 * GPU context. Nothing here knows about wrappers, managers, or the frame
 * graph — this is the floor everything else stands on.
 */

export class GPUContext {
    readonly adapter: GPUAdapter;
    readonly device: GPUDevice;
    readonly context: GPUCanvasContext;
    readonly format: GPUTextureFormat;
    readonly canvas: HTMLCanvasElement;

    private resizeObserver: ResizeObserver;
    private onResizeCallbacks: Array<(width: number, height: number) => void> = [];

    private constructor(
        adapter: GPUAdapter,
        device: GPUDevice,
        context: GPUCanvasContext,
        format: GPUTextureFormat,
        canvas: HTMLCanvasElement
    ) {
        this.adapter = adapter;
        this.device = device;
        this.context = context;
        this.format = format;
        this.canvas = canvas;

        // Keep the swapchain in sync with the canvas's actual display size.
        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = Math.max(1, Math.floor(entry.contentBoxSize[0].inlineSize));
                const height = Math.max(1, Math.floor(entry.contentBoxSize[0].blockSize));
                this.resize(width, height);
            }
        });
        this.resizeObserver.observe(canvas);

        // Surface uncaptured device errors instead of failing silently mid-frame.
        this.device.addEventListener('uncapturederror', (event) => {
            console.error('[GPUContext] Uncaptured WebGPU error:', (event as GPUUncapturedErrorEvent).error);
        });

        // Handle device loss (driver reset, tab backgrounding on some platforms, etc).
        this.device.lost.then((info) => {
            console.error(`[GPUContext] Device lost: ${info.reason} — ${info.message}`);
            // Recovery strategy (re-request device, rebuild resources) is a
            // deliberate decision for later — surfacing it clearly now beats
            // silently hanging.
        });

    }

    /**
     * Async factory — WebGPU's adapter/device requests are promise-based,
     * so this can't be a plain constructor.
     */
    static async create(canvas: HTMLCanvasElement): Promise<GPUContext> {
        if (!('gpu' in navigator)) {
            throw new Error('WebGPU is not supported in this browser.');
        }

        const adapter = await navigator.gpu.requestAdapter({
            powerPreference: 'high-performance',
        });
        if (!adapter) {
            throw new Error('No suitable GPU adapter found.');
        }

        const device = await adapter.requestDevice();

        const context = canvas.getContext('webgpu');
        if (!context) {
            throw new Error('Failed to acquire a WebGPU canvas context.');
        }

        const format = navigator.gpu.getPreferredCanvasFormat();

        context.configure({
            device,
            format,
            alphaMode: 'opaque',
        });

        return new GPUContext(adapter, device, context, format, canvas);
    }

    /** Reconfigure the swapchain to a new pixel size. Call on resize. */
    resize(width: number, height: number): void {
        const dpr = window.devicePixelRatio ?? 1;
        this.canvas.width = Math.max(1, Math.floor(width * dpr));
        this.canvas.height = Math.max(1, Math.floor(height * dpr));

        // Re-configuring is cheap and is the documented way to handle resize —
        // no need to tear down and recreate the context itself.
        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: 'opaque',
        });

        for (const cb of this.onResizeCallbacks) {
            cb(this.canvas.width, this.canvas.height);
        }
    }

    /** Register a callback for when the swapchain resizes (e.g. to recreate depth targets). */
    onResize(callback: (width: number, height: number) => void): void {
        this.onResizeCallbacks.push(callback);
    }

    /** Convenience accessor for the current swapchain texture, once per frame. */
    getCurrentTexture(): GPUTexture {
        return this.context.getCurrentTexture();
    }

    dispose(): void {
        this.resizeObserver.disconnect();
        this.onResizeCallbacks = [];
        this.device.destroy();
    }
}
