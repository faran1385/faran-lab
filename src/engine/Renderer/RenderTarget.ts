export interface TextureSettings {
    format: GPUTextureFormat;
}

export class RenderTarget {
    width: number;
    height: number;

    private texture?: GPUTexture;
    private settings: TextureSettings;

    constructor(width: number, height: number, settings: TextureSettings) {
        this.width = width;
        this.height = height;
        this.settings = settings;
    }

    get format(): GPUTextureFormat {
        return this.settings.format;
    }

    setSettings(settings: TextureSettings): void {
        this.settings = settings;
        this.dispose();
    }

    setSize(width: number, height: number): void {
        if (this.width === width && this.height === height) return;
        this.width = width;
        this.height = height;
        this.dispose();
    }

    ensureTexture(device: GPUDevice) {
        if (!this.texture) {
            this.texture = device.createTexture({
                size: [this.width, this.height],
                format: this.settings.format,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            });
        }
    }

    getTexture() {
        return this.texture;
    }

    dispose(): void {
        this.texture?.destroy();
        this.texture = undefined;
    }
}