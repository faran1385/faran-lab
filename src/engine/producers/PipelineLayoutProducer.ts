import {BindGroupLayoutManager, GLOBAL_LAYOUT_KEY} from "../managers/BindGroupLayoutManager.ts";
import type {MaterialHashes} from "../hashing/utils/HashData.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";

export interface PipelineLayoutProduceArgs {
    material: MaterialWrapper;
    hashes: MaterialHashes;
    /** Key of the node bind group layout (group 2) this pipeline layout is used with. */
    nodeLayout: string;
    layouts: BindGroupLayoutManager;
}

export class PipelineLayoutProducer {
    static produce({material, hashes, nodeLayout, layouts}: PipelineLayoutProduceArgs): GPUPipelineLayoutDescriptor {
        return {
            label: material.uuid,
            bindGroupLayouts: [
                layouts.getRaw(GLOBAL_LAYOUT_KEY),                              // group 0: scene
                layouts.getRaw(hashes.layout),                                  // group 1: material
                layouts.getRaw(nodeLayout),                                     // group 2: node
            ],
        };
    }
}