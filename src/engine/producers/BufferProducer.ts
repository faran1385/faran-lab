import {BufferWrapper} from "../wrappers/BufferWrapper.ts";
import type {MaterialFactorsPlan} from "./utils.ts";
import type {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import type {SkinInstanceWrapper} from "../wrappers/SkinInstanceWrapper.ts";

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

/** Bytes per joint of an LBS palette: one mat4x4f. A skinning module with another layout passes its own stride. */
export const LBS_PALETTE_STRIDE_BYTES = 64;

/**
 * Allocates a skin's palette buffer; it only sizes and initializes it. Writing real values is a skinning module's job.
 * The initial contents are identity matrices (valid for the default LBS stride), so a skinned mesh draws in its
 * un-deformed pose until the first palette write instead of collapsing to the origin.
 */
export class SkinPaletteBufferProducer {
    static produce(skin: SkinInstanceWrapper, strideBytes: number = LBS_PALETTE_STRIDE_BYTES) {
        const data = new Float32Array(skin.getJointCount() * strideBytes / 4);
        if (strideBytes === LBS_PALETTE_STRIDE_BYTES) {
            for (let i = 0; i < skin.getJointCount(); i++) {
                const o = i * 16;
                data[o] = data[o + 5] = data[o + 10] = data[o + 15] = 1;
            }
        }
        return new BufferWrapper(data.buffer, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    }
}
