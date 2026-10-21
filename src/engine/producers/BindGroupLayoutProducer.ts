import type {BindgroupLayoutRepresentation} from "../Representations/BindgroupLayoutRepresentation.ts";
import {bufferBindingTypeOf, textureSampleTypeOf} from "../Representations/bindingTypes.ts";

export const FACTORS_BINDING = 0;

export interface BindingSlot { binding: number; kind: "texture" | "sampler" }
export interface ComponentBindings { texture: number; sampler: number; texCoord: string }
export interface MaterialBindingPlan {
    slots: BindingSlot[];
    byComponent: Map<string, ComponentBindings>;
    signature: string;
}


export class BindGroupLayoutProducer {
    /** Pure translation of a layout representation into a descriptor. Entries are written in binding order. */
    static produce(layout: BindgroupLayoutRepresentation, label: string): GPUBindGroupLayoutDescriptor {
        const entries: GPUBindGroupLayoutEntry[] = [];

        for (const entry of layout.getEntries()) {
            if ("buffer" in entry) {
                entries.push({
                    binding: entry.binding,
                    visibility: entry.visibility,
                    buffer: {type: bufferBindingTypeOf(entry.buffer)},
                });
            } else if ("sampler" in entry) {
                entries.push({
                    binding: entry.binding,
                    visibility: entry.visibility,
                    sampler: {type: "filtering"},
                });
            } else {
                entries.push({
                    binding: entry.binding,
                    visibility: entry.visibility,
                    texture: {sampleType: textureSampleTypeOf(entry.texture.getFormat()), viewDimension: "2d"},
                });
            }
        }

        entries.sort((a, b) => a.binding - b.binding);
        return {label, entries};
    }
}
