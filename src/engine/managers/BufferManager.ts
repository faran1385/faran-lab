import {ResourceManager} from "./Manager.ts";
import type {BufferWrapper} from "../wrappers/BufferWrapper.ts";
import {BufferTracker} from "../Trackers/Trackers.ts";

interface BufferCreationInput {
    wrapper: BufferWrapper;
    usage: GPUBufferUsageFlags;
}


export class BufferManager extends ResourceManager<BufferCreationInput, GPUBuffer, BufferTracker> {
    createOrGetUniformBuffer(buffer: BufferWrapper): BufferTracker {
        return this.createOrGetWithUsage(buffer, GPUBufferUsage.UNIFORM);
    }

    createOrGetVertexBuffer(buffer: BufferWrapper): BufferTracker {
        return this.createOrGetWithUsage(buffer, GPUBufferUsage.VERTEX);
    }

    createOrGetIndexBuffer(buffer: BufferWrapper): BufferTracker {
        return this.createOrGetWithUsage(buffer, GPUBufferUsage.INDEX);
    }

    createOrGetStorageBuffer(buffer: BufferWrapper): BufferTracker {
        return this.createOrGetWithUsage(buffer, GPUBufferUsage.STORAGE);
    }

    private createOrGetWithUsage(wrapper: BufferWrapper, requiredUsage: GPUBufferUsageFlags): BufferTracker {
        const usage = wrapper.getUsage() | requiredUsage | GPUBufferUsage.COPY_DST;
        return this.createOrGet({ wrapper, usage });
    }

    protected getHash(input: BufferCreationInput): string {
        return `${input.wrapper.convertToHash(this.hasher)}|${input.usage}`;
    }

    protected createResource(input: BufferCreationInput): GPUBuffer {
        const gpuBuffer = this.device.createBuffer({
            size: input.wrapper.getData().byteLength,
            usage: input.usage,
        });
        this.upload(gpuBuffer, input.wrapper);
        return gpuBuffer;
    }

    protected createTracker(resource: GPUBuffer): BufferTracker {
        return new BufferTracker(resource);
    }

    private upload(gpuBuffer: GPUBuffer, wrapper: BufferWrapper): void {
        this.device.queue.writeBuffer(gpuBuffer, 0, wrapper.getData());
    }
}