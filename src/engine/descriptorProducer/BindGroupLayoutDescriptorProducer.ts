import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";

export class BindGroupLayoutDescriptorProducer {
    static produce(material: MaterialWrapper): GPUBindGroupLayoutDescriptor {
        const layout = material.getLayoutDescriptor();
        const entries: GPUBindGroupLayoutEntry[] = [];

        if (layout.uniformBufferBinding !== null) {
            entries.push({
                binding: layout.uniformBufferBinding,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                    minBindingSize: layout.uniformBufferSize,
                },
            });
        }

        for (const name in layout.components) {
            const component = layout.components[name];
            if (!component.texture) continue;

            entries.push({
                binding: component.texture.textureBinding,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float",
                    viewDimension: "2d",
                },
            });
            entries.push({
                binding: component.texture.samplerBinding,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "filtering",
                },
            });
        }

        return { entries };
    }
}