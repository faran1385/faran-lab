import {BufferInternal} from "../internals/BufferInternal.ts";

export interface BufferDescriptor {
    label: string;
    size: number;
    usage: GPUBufferUsageFlags;
    data: ArrayBuffer;
}

export class BufferProducer {
    static produce(buffer: BufferInternal): BufferDescriptor {
        const data = buffer.getData();
        return {
            label: buffer.uuid,
            size: Math.ceil(data.byteLength / 4) * 4,
            usage: buffer.getUsage(),
            data,
        };
    }
}
