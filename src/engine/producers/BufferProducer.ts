import {BufferWrapper} from "../wrappers/BufferWrapper.ts";
import type {MaterialFactorsPlan} from "./utils.ts";
import type {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import type {SkinInstanceWrapper} from "../wrappers/SkinInstanceWrapper.ts";
import type {SkinningMethod} from "../skinning/SkinningMethod.ts";

export interface BufferDescriptor {
    label: string;
    size: number;
    usage: GPUBufferUsageFlags;
    data: ArrayBuffer;
}

export class BufferProducer {
    static produce(wrapper: BufferWrapper): BufferDescriptor {
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
        return new BufferWrapper(new Float32Array(Array.from(factorPlan).map(([_, item]) => item.factor).flat()).buffer, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST)
    }
}


export class NodeMatrixBufferProducer {
    static produce(node: NodeWrapper) {
        return new BufferWrapper(node.getWorldMatrix().buffer, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST)
    }
}

/** Allocates the palette exactly as described by the selected skinning method. */
export class SkinPaletteBufferProducer {
    static produce(skin: SkinInstanceWrapper, method: SkinningMethod) {
        if (!Number.isInteger(method.paletteStrideBytes) || method.paletteStrideBytes <= 0 || method.paletteStrideBytes % 4 !== 0) {
            throw new Error(`SkinPaletteBufferProducer: invalid palette stride ${method.paletteStrideBytes}`);
        }
        const data = method.initialPalette(skin.getJointCount());
        const expectedBytes = skin.getJointCount() * method.paletteStrideBytes;
        if (data.byteLength !== expectedBytes) {
            throw new Error(`SkinPaletteBufferProducer: method "${method.id}" initialized ${data.byteLength} bytes, expected ${expectedBytes}`);
        }
        return new BufferWrapper(data, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    }
}
