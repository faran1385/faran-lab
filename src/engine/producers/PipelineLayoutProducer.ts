import {BindGroupLayoutManager, GLOBAL_LAYOUT_KEY, NODE_LAYOUT_KEY} from "../managers/BindGroupLayoutManager.ts";
import type {MaterialHashes} from "../hashing/HashData.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";

export interface PipelineLayoutProduceArgs {
    material: MaterialWrapper;
    hashes: MaterialHashes;
    layouts: BindGroupLayoutManager;
}

export class PipelineLayoutProducer {
    static produce({material, hashes, layouts}: PipelineLayoutProduceArgs): GPUPipelineLayoutDescriptor {
        return {
            label: material.uuid,
            bindGroupLayouts: [
                layouts.getRaw(GLOBAL_LAYOUT_KEY),                              // group 0: scene
                layouts.getRaw(hashes.layout),                                  // group 1: material
                layouts.getRaw(NODE_LAYOUT_KEY),                                // group 2: node
            ],
        };
    }
}