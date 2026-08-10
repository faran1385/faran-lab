import {TextureResourceWrapper} from "./TextureResourceWrapper.ts";
import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import type {Hasher} from "../hashing/Hasher.ts";

const TEXTURE_FORMAT_BYTES_PER_PIXEL: Partial<Record<GPUTextureFormat, number>> = {
    "rgba8unorm": 4,
    "rgba8unorm-srgb": 4,
    "bgra8unorm": 4,
    "r8unorm": 1,
    "rg8unorm": 2,
};

function bytesPerRowFor(format: GPUTextureFormat, width: number): number {
    const bpp = TEXTURE_FORMAT_BYTES_PER_PIXEL[format];
    if (bpp === undefined) {
        throw new Error(`bytesPerRowFor: unsupported format "${format}"`);
    }
    return bpp * width;
}

export class TextureManager {
    private textures = new Map<string, TextureResourceWrapper>();

    ensure(
        image: ImageWrapper,
        hasher: Hasher,
        device: GPUDevice
    ): TextureResourceWrapper {
        const hash = image.convertToHash(hasher);

        const existing = this.textures.get(hash);
        if (existing) {
            existing.retain();
            return existing;
        }

        const { width, height } = image.getDimensions();
        const format = image.getFormat();

        const gpuTexture = device.createTexture({
            size: { width, height },
            format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        device.queue.writeTexture(
            { texture: gpuTexture },
            image.getData(),
            { bytesPerRow: bytesPerRowFor(format, width) },
            { width, height }
        );

        const wrapper = new TextureResourceWrapper(hash, gpuTexture);
        wrapper.retain();
        this.textures.set(hash, wrapper);
        return wrapper;
    }

    get(hash: string): TextureResourceWrapper | undefined {
        return this.textures.get(hash);
    }
}