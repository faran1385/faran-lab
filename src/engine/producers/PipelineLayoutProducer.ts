import type {PipelineLayoutRepresentation} from "../Representations/PipelineLayoutRepresentation.ts";
import type {Hasher} from "../hashing/utils/Hasher.ts";
import type {CentralManager} from "../managers/CentralManager.ts";

export interface PipelineLayoutProduceArgs {
    layout: PipelineLayoutRepresentation;
    hasher: Hasher;
    managers: CentralManager;
    label: string;
}

export class PipelineLayoutProducer {
    /** Groups must be contiguous from 0: a pipeline layout is an array indexed by group. */
    static produce({layout, hasher, managers, label}: PipelineLayoutProduceArgs): GPUPipelineLayoutDescriptor {
        const layouts = layout.getLayouts();
        const groupCount = layouts.size === 0 ? 0 : Math.max(...layouts.keys()) + 1;

        const bindGroupLayouts: GPUBindGroupLayout[] = [];
        for (let group = 0; group < groupCount; group++) {
            const groupLayout = layouts.get(group);
            if (!groupLayout) throw new Error(`PipelineLayoutProducer: no bind group layout for group ${group} (groups must be contiguous from 0)`);
            bindGroupLayouts.push(managers.bindgroupLayoutManager.getRaw(groupLayout.hashProvider.convertToHash(hasher)));
        }

        return {label, bindGroupLayouts};
    }
}
