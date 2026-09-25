import {ResourceManager} from "./Manager.ts";
import {BufferTracker} from "../Trackers/Trackers.ts";
import type {BufferDescriptor} from "../producers/BufferProducer.ts";

export class BufferManager extends ResourceManager<BufferDescriptor, BufferTracker> {
    private device: GPUDevice;
    constructor(device: GPUDevice) { super(); this.device = device; }

    protected build(getDescriptor: () => BufferDescriptor): BufferTracker {
        const { label, size, usage, data } = getDescriptor();
        const buffer = this.device.createBuffer({ label, size, usage, mappedAtCreation: true });
        new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data));
        buffer.unmap();
        return new BufferTracker(buffer);
    }

    upload(hash: string, data: GPUAllowSharedBufferSource, offset = 0): void {
        const tracker = this.cache.get(hash)
        if (!tracker) throw new Error(`BufferManager.upload: no buffer for "${hash}", call ensure() first`);

        const buffer = tracker.raw
        if (offset + data.byteLength > buffer.size)
            throw new Error(`BufferManager.upload: ${data.byteLength}B at offset ${offset} overflows "${hash}" (${buffer.size}B)`);

        this.device.queue.writeBuffer(buffer, offset, data);
    }
}