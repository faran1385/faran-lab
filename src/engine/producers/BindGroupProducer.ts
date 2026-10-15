import {
    FACTORS_BINDING,
    NODE_MATRIX_BINDING,
    NODE_PALETTE_BINDING,
    type MaterialBindingPlan
} from "./BindGroupLayoutProducer.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {MaterialHashes} from "../hashing/utils/HashData.ts";
import {type BindGroupLayoutManager, GLOBAL_LAYOUT_KEY} from "../managers/BindGroupLayoutManager.ts";
import type {BufferManager} from "../managers/BufferManager.ts";
import type {TextureManager} from "../managers/TextureManager.ts";
import type {SamplerManager} from "../managers/SamplerManager.ts";
import type {NodeResourceKeys} from "../hashing/utils/HashData.ts";

export interface BindGroupProduceArgs {
    material: MaterialWrapper;
    hashes: MaterialHashes;
    layouts: BindGroupLayoutManager;
    buffers: BufferManager;
    textures: TextureManager;
    samplers: SamplerManager;
}


export class BindGroupProducer {
    static produce(
        {material, hashes, layouts, buffers, textures, samplers}: BindGroupProduceArgs,
        getPlan: () => MaterialBindingPlan,
    ): GPUBindGroupDescriptor {
        const sorted = material.getSortedComponents();
        const plan = getPlan();

        const layout = layouts.getRaw(hashes.layout);

        const entries: GPUBindGroupEntry[] = [
            {binding: FACTORS_BINDING, resource: {buffer: buffers.getRaw(hashes.factors)},},
        ];

        const written = new Set<number>();

        for (const c of sorted) {
            const slot = c.getTexture();
            if (!slot) continue;

            const b = plan.byComponent.get(c.name)!;
            const textureHashes = hashes.textures.get(c.name)!;

            if (!written.has(b.texture)) {
                written.add(b.texture);
                const tracker = textures.get(textureHashes.image);
                entries.push({binding: b.texture, resource: tracker.getOrCreateView("2d", {dimension: "2d"})});
            }

            if (!written.has(b.sampler)) {
                written.add(b.sampler);
                entries.push({binding: b.sampler, resource: samplers.getRaw(textureHashes.sampler)});
            }
        }

        return {label: material.uuid, layout, entries};
    }
}


export interface NodeBindgroupProduceArgs {
    layouts: BindGroupLayoutManager,
    buffers: BufferManager,
    keys: NodeResourceKeys
}

export class NodeBindGroupProducer {
    static produce(
        {layouts, buffers, keys}: NodeBindgroupProduceArgs,
    ): GPUBindGroupDescriptor {

        const layout = layouts.getRaw(keys.layout);

        const entries: GPUBindGroupEntry[] = [
            {binding: NODE_MATRIX_BINDING, resource: {buffer: buffers.getRaw(keys.matrixBuffer)},},
        ];

        // the layout has a palette binding exactly when the node has a palette buffer
        if (keys.paletteBuffer !== undefined) {
            entries.push({binding: NODE_PALETTE_BINDING, resource: {buffer: buffers.getRaw(keys.paletteBuffer)}});
        }

        return {label: keys.bindgroup, layout, entries};
    }
}


export interface SceneBindgroupProduceArgs {
    layouts: BindGroupLayoutManager,
    buffers: BufferManager,
    rendererUUID: string
}

export class SceneBindGroupProducer {
    static produce(
        {layouts, buffers, rendererUUID}: SceneBindgroupProduceArgs,
    ): GPUBindGroupDescriptor {
        const layout = layouts.getRaw(GLOBAL_LAYOUT_KEY);


        const entries: GPUBindGroupEntry[] = [
            {binding: 0, resource: {buffer: buffers.getRaw(rendererUUID)},},
        ];

        return {label: "", layout, entries};
    }
}

