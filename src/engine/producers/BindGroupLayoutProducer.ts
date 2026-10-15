import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";

export const FACTORS_BINDING = 0;

// Group 2 (node). The palette binding exists only in the skinned variant of the layout.
export const NODE_MATRIX_BINDING = 0;
export const NODE_PALETTE_BINDING = 1;

/**
 * Cache key of a node bind group layout. A node has exactly two layout shapes, so the key is just the shape; the
 * layout itself is generated at runtime (NodeBindGroupLayoutProducer) and cached under it like every other layout.
 */
export function nodeLayoutKey(skinned: boolean): string {
    return skinned ? "NODE_LAYOUT|skinned" : "NODE_LAYOUT|plain";
}

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

export class NodeBindGroupLayoutProducer {
    static produce(skinned: boolean): GPUBindGroupLayoutDescriptor {
        const entries: GPUBindGroupLayoutEntry[] = [
            // world matrix
            {binding: NODE_MATRIX_BINDING, visibility: GPUShaderStage.VERTEX, buffer: {type: "uniform"}},
        ];

        if (skinned) {
            // joint palette: one element per joint, written by a skinning module
            entries.push({binding: NODE_PALETTE_BINDING, visibility: GPUShaderStage.VERTEX, buffer: {type: "read-only-storage"}});
        }

        return {label: nodeLayoutKey(skinned), entries};
    }
}

