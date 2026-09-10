import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import {TextureTracker} from "../Trackers/Trackers.ts";
import {ResourceManager} from "./Manager.ts";


interface TextureCreationInput {
    wrapper: ImageWrapper;
    usage: GPUTextureUsageFlags;
}

export class TextureManager extends ResourceManager<TextureCreationInput, GPUTexture, TextureTracker> {
    createOrGetSampledTexture(image: ImageWrapper): TextureTracker {
        return this.createOrGetWithUsage(image, GPUTextureUsage.TEXTURE_BINDING);
    }

    createOrGetRenderTarget(image: ImageWrapper): TextureTracker {
        return this.createOrGetWithUsage(image, GPUTextureUsage.RENDER_ATTACHMENT);
    }

    createOrGetStorageTexture(image: ImageWrapper): TextureTracker {
        return this.createOrGetWithUsage(image, GPUTextureUsage.STORAGE_BINDING);
    }

    private createOrGetWithUsage(wrapper: ImageWrapper, requiredUsage: GPUTextureUsageFlags): TextureTracker {
        const usage = requiredUsage | GPUTextureUsage.COPY_DST;
        return this.createOrGet({ wrapper, usage });
    }

    protected getHash(input: TextureCreationInput): string {
        return `${input.wrapper.convertToHash(this.hasher)}|${input.usage}`;
    }

    protected createResource(input: TextureCreationInput): GPUTexture {
        const { width, height } = input.wrapper.getDimensions();
        const texture = this.device.createTexture({
            size: { width, height, depthOrArrayLayers: 1 },
            format: input.wrapper.getFormat(),
            dimension: "2d",
            mipLevelCount: 1,
            sampleCount: 1,
            usage: input.usage,
        });
        this.upload(texture, input.wrapper);
        return texture;
    }

    protected createTracker(resource: GPUTexture): TextureTracker {
        return new TextureTracker(resource);
    }

    private upload(texture: GPUTexture, wrapper: ImageWrapper): void {
        const { width, height } = wrapper.getDimensions();
        const bytesPerPixel = this.bytesPerPixel(wrapper.getFormat());

        this.device.queue.writeTexture(
            { texture },
            wrapper.getData(),
            { bytesPerRow: width * bytesPerPixel, rowsPerImage: height },
            { width, height, depthOrArrayLayers: 1 },
        );
    }

    private bytesPerPixel(format: GPUTextureFormat): number {
        switch (format) {
            case "rgba8unorm":
            case "rgba8unorm-srgb":
            case "bgra8unorm":
            case "bgra8unorm-srgb":
                return 4;
            default:
                throw new Error(`TextureManager: unhandled format ${format}`);
        }
    }
}