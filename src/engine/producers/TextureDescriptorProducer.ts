import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";

export interface TextureDescriptor {
    texture: GPUTextureDescriptor;
    data: ArrayBuffer;
    bytesPerRow: number;
    width: number;
    height: number;
}

const BYTES_PER_TEXEL: Partial<Record<GPUTextureFormat, number>> = {
    r8unorm: 1, rg8unorm: 2, rgba8unorm: 4, "rgba8unorm-srgb": 4,
    bgra8unorm: 4, "bgra8unorm-srgb": 4, r32float: 4, rgba16float: 8, rgba32float: 16,
};

export class TextureProducer {
    static produce(image: ImageWrapper): TextureDescriptor {
        const { width, height } = image.getDimensions();
        const format = image.getFormat();
        const data = image.getData();

        const bytesPerTexel = BYTES_PER_TEXEL[format];
        if (bytesPerTexel === undefined) {
            throw new Error(`TextureProducer: unsupported format "${format}" (add it to BYTES_PER_TEXEL)`);
        }
        if (data.byteLength !== width * height * bytesPerTexel) {
            throw new Error(
                `TextureProducer: image ${image.uuid} has ${data.byteLength} bytes, expected ${width * height * bytesPerTexel} for ${width}x${height} ${format}`
            );
        }

        return {
            texture: {
                label: image.uuid,
                size: { width, height },
                format,
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            },
            data,
            bytesPerRow: width * bytesPerTexel,
            width,
            height,
        };
    }
}




