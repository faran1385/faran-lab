import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";

export const FACTORS_BINDING = 0;

export interface BindingSlot { binding: number; kind: "texture" | "sampler" }
export interface ComponentBindings { texture: number; sampler: number; texCoord: string }
export interface MaterialBindingPlan {
    slots: BindingSlot[];
    byComponent: Map<string, ComponentBindings>;
    signature: string;
}


export class BindGroupLayoutProducer {
    static produce(material: MaterialWrapper, getPlan: () => MaterialBindingPlan): GPUBindGroupLayoutDescriptor {
        const plan = getPlan();

        const entries: GPUBindGroupLayoutEntry[] = [
            { binding: FACTORS_BINDING, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        ];

        for (const slot of plan.slots) {
            entries.push(
                slot.kind === "texture"
                    ? { binding: slot.binding, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float", viewDimension: "2d" } }
                    : { binding: slot.binding, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } }
            );
        }

        return { label: material.uuid, entries };
    }
}

