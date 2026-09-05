import type {Hasher} from "../hashing/Hasher.ts";
import {BufferResourceWrapper} from "./BufferResourceWrapper.ts";
import type {BufferWrapper} from "../wrappers/BufferWrapper.ts";

export class BufferManager {
    private buffers = new Map<string, BufferResourceWrapper>();

    ensure(
        attr: BufferWrapper<any>,
        hasher: Hasher,
        device: GPUDevice
    ): BufferResourceWrapper {
        const hash = attr.convertToHash(hasher);

        const existing = this.buffers.get(hash);
        if (existing) {
            existing.retain();
            return existing;
        }

        const data = attr.getData();
        const gpuBuffer = device.createBuffer({
            size: data.byteLength,
            usage: attr.getUsage(),
        });
        device.queue.writeBuffer(gpuBuffer, 0, data);

        const wrapper = new BufferResourceWrapper(hash, gpuBuffer);
        wrapper.retain();
        this.buffers.set(hash, wrapper);
        return wrapper;
    }

    get(hash: string): BufferResourceWrapper | undefined {
        return this.buffers.get(hash);
    }
}