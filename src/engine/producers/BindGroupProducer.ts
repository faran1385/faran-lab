import {FACTORS_BINDING, type MaterialBindingPlan} from "./BindGroupLayoutProducer.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {Hasher} from "../hashing/Hasher.ts";
import {type BindGroupLayoutManager, GLOBAL_LAYOUT_KEY, NODE_LAYOUT_KEY} from "../managers/BindGroupLayoutManager.ts";
import type {BufferManager} from "../managers/BufferManager.ts";
import type {TextureManager} from "../managers/TextureManager.ts";
import type {SamplerManager} from "../managers/SamplerManager.ts";
import type {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import type {Camera} from "../Camera/Camera.ts";

export interface BindGroupProduceArgs {
    material: MaterialWrapper;
    hasher: Hasher;
    layouts: BindGroupLayoutManager;
    buffers: BufferManager;
    textures: TextureManager;
    samplers: SamplerManager;
}


export class BindGroupProducer {
    static produce(
        {material, hasher, layouts, buffers, textures, samplers}: BindGroupProduceArgs,
        getPlan: () => MaterialBindingPlan,
    ): GPUBindGroupDescriptor {
        const sorted = material.getSortedComponents();
        const plan = getPlan();

        const layout = layouts.getRaw(material.convertToBindgroupLayoutHash(hasher));

        const entries: GPUBindGroupEntry[] = [
            {binding: FACTORS_BINDING, resource: {buffer: buffers.getRaw(material.convertToFactorsHash(hasher))},},
        ];

        const written = new Set<number>();

        for (const c of sorted) {
            const slot = c.getTexture();
            if (!slot) continue;

            const b = plan.byComponent.get(c.name)!;

            if (!written.has(b.texture)) {
                written.add(b.texture);
                const image = slot.wrapper.getImage();
                const tracker = textures.get(image.convertToHash(hasher));
                entries.push({binding: b.texture, resource: tracker.getOrCreateView("2d", {dimension: "2d"})});
            }

            if (!written.has(b.sampler)) {
                written.add(b.sampler);
                const sampler = slot.wrapper.getSampler();
                entries.push({binding: b.sampler, resource: samplers.getRaw(sampler.convertToHash(hasher))});
            }
        }

        return {label: material.uuid, layout, entries};
    }
}


export interface NodeBindgroupProduceArgs {
    layouts: BindGroupLayoutManager,
    buffers: BufferManager,
    node: NodeWrapper
}

export class NodeBindGroupProducer {
    static produce(
        {layouts, buffers, node}: NodeBindgroupProduceArgs,
    ): GPUBindGroupDescriptor {

        const layout = layouts.getRaw(NODE_LAYOUT_KEY);

        const entries: GPUBindGroupEntry[] = [
            {binding: 0, resource: {buffer: buffers.getRaw(node.uuid)},},
        ];

        return {label: node.uuid, layout, entries};
    }
}


export interface SceneBindgroupProduceArgs {
    layouts: BindGroupLayoutManager,
    buffers: BufferManager,
    camera: Camera
}

export class SceneBindGroupProducer {
    static produce(
        {layouts, buffers, camera}: SceneBindgroupProduceArgs,
    ): GPUBindGroupDescriptor {
        const layout = layouts.getRaw(GLOBAL_LAYOUT_KEY);


        const entries: GPUBindGroupEntry[] = [
            {binding: 0, resource: {buffer: buffers.getRaw(camera.uuid)},},
        ];

        return {label: "", layout, entries};
    }
}

