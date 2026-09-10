import type {BufferWrapper} from "../wrappers/BufferWrapper.ts";

export class BufferDescriptorProducer {
    static produce(buffer: BufferWrapper): GPUBufferDescriptor {
        return {
            size: buffer.getData().byteLength,
            usage: buffer.getUsage(),
        };
    }
}