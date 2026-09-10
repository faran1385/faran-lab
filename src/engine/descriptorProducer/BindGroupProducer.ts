import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {TextureManager} from "../managers/TextureManager.ts";
import type {SamplerManager} from "../managers/SamplerManager.ts";
import type {BufferManager} from "../managers/BufferManager.ts";
import {MaterialFactorsBuffer} from "../wrappers/MaterialFactorsBuffer.ts";

class MaterialFactorsProducer {
    static produce(material: MaterialWrapper): ArrayBuffer {
        const layout = material.getLayoutDescriptor();
        const buffer = new ArrayBuffer(layout.uniformBufferSize);
        const view = new DataView(buffer);

        for (const component of material.getAllComponents()) {
            const fieldLayout = layout.getUniformField(component.name);
            if (!fieldLayout) continue; // this component contributes no factor bytes

            const factors = component.getFactors();
            let byteOffset = fieldLayout.offset;

            for (const value of factors) {
                view.setFloat32(byteOffset, value, true);
                byteOffset += 4;
            }
        }

        return buffer;
    }
}

export class BindGroupProducer {
    static produce(
        material: MaterialWrapper,
        layout: GPUBindGroupLayout,
        textureManager: TextureManager,
        samplerManager: SamplerManager,
        bufferManager: BufferManager,
    ): GPUBindGroupDescriptor {
        const layoutDescriptor = material.getLayoutDescriptor();
        const entries: GPUBindGroupEntry[] = [];

        if (layoutDescriptor.uniformBufferBinding !== null) {
            const factorsData = MaterialFactorsProducer.produce(material);
            const factorsBuffer = new MaterialFactorsBuffer(factorsData, material.uuid);
            const bufferTracker = bufferManager.createOrGetUniformBuffer(factorsBuffer);

            entries.push({
                binding: layoutDescriptor.uniformBufferBinding,
                resource: { buffer: bufferTracker.raw },
            });
        }

        for (const component of material.getAllComponents()) {
            const slot = component.getTexture();
            if (!slot) continue;

            const fieldLayout = layoutDescriptor.getTextureBinding(component.name);
            if (!fieldLayout) continue;

            const textureTracker = textureManager.createOrGetSampledTexture(slot.wrapper.getImage());
            const samplerTracker = samplerManager.createOrGetFromSampler(slot.wrapper.getSampler());
            const view = textureTracker.getOrCreateView("default", {});

            entries.push({
                binding: fieldLayout.textureBinding,
                resource: view,
            });
            entries.push({
                binding: fieldLayout.samplerBinding,
                resource: samplerTracker.raw,
            });
        }

        return { layout, entries };
    }
}