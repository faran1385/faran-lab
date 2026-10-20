import {BufferInternal} from "../internals/BufferInternal.ts";
import type {MaterialFactorsPlan} from "./utils.ts";
import type {NodeWrapper} from "../wrappers/NodeWrapper.ts";

export interface BufferDescriptor {
    label: string;
    size: number;
    usage: GPUBufferUsageFlags;
    data: ArrayBuffer;
}

export class BufferProducer {
    static produce(wrapper: BufferInternal): BufferDescriptor {
        const data = wrapper.getData();
        return {
            label: wrapper.uuid,
            size: Math.ceil(data.byteLength / 4) * 4,
            usage: wrapper.getUsage(),
            data,
        };
    }
}

export class MaterialFactorBufferProducer {
    static produce(factorPlan: MaterialFactorsPlan) {
        return new BufferInternal(new Float32Array(Array.from(factorPlan).map(([_, item]) => item.factor).flat()).buffer, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST)
    }
}


export class NodeMatrixBufferProducer {
    static produce(node: NodeWrapper) {
        return new BufferInternal(node.getWorldMatrix(), GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST)
    }
}


