import {BindGroupLayoutManager, GLOBAL_LAYOUT_KEY, NODE_LAYOUT_KEY} from "../managers/BindGroupLayoutManager.ts";
import type {Hasher} from "../hashing/Hasher.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";

export interface PipelineLayoutProduceArgs {
    material: MaterialWrapper;
    hasher: Hasher;
    layouts: BindGroupLayoutManager;
}

export class PipelineLayoutProducer {
    static produce({material, hasher, layouts}: PipelineLayoutProduceArgs): GPUPipelineLayoutDescriptor {
        return {
            label: material.uuid,
            bindGroupLayouts: [
                layouts.getRaw(GLOBAL_LAYOUT_KEY),                              // group 0: scene
                layouts.getRaw(material.convertToBindgroupLayoutHash(hasher)),  // group 1: material
                layouts.getRaw(NODE_LAYOUT_KEY),                                // group 2: node
            ],
        };
    }
}