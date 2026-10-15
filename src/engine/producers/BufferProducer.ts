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

/**
 * Allocates a skin's palette buffer; it only sizes and initializes it, the contents come from the skinning method
 * (`initialPalette`), and writing real values every frame is its `update`.
 */
export class SkinPaletteBufferProducer {
    static produce(skin: SkinInstanceWrapper, method: SkinningMethod) {
        const data = method.initialPalette(skin.getJointCount());
        const expected = skin.getJointCount() * method.paletteStrideBytes;
        if (data.byteLength !== expected) {
            throw new Error(`SkinPaletteBufferProducer: "${method.id}" initialPalette is ${data.byteLength}B, expected ${expected}B (${skin.getJointCount()} joints x ${method.paletteStrideBytes}B)`);
        }
        return new BufferWrapper(data, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    }
}
