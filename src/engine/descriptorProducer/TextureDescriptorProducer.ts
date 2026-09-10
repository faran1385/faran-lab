import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";

export class TextureDescriptorProducer {
    static produce(image: ImageWrapper): GPUTextureDescriptor {
        const { width, height } = image.getDimensions();

        return {
            size: { width, height, depthOrArrayLayers: 1 },
            format: image.getFormat(),
            dimension: "2d",
            mipLevelCount: 1,
            sampleCount: 1,
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST,
        };
    }
}