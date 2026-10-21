import type {BindgroupRepresentation} from "../Representations/BindgroupRepresentation.ts";
import {BufferInternal} from "../internals/BufferInternal.ts";
import {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import type {Hasher} from "../hashing/utils/Hasher.ts";
import type {CentralManager} from "../managers/CentralManager.ts";

export interface BindGroupProduceArgs {
    bindgroup: BindgroupRepresentation;
    /** Key of the layout in the bind group layout manager; it must already exist. */
    layoutKey: string;
    hasher: Hasher;
    managers: CentralManager;
    label: string;
}

export class BindGroupProducer {
    /** Every resource the representation binds must already exist in its manager (the resource layer ensured it). */
    static produce({bindgroup, layoutKey, hasher, managers, label}: BindGroupProduceArgs): GPUBindGroupDescriptor {
        const entries: GPUBindGroupEntry[] = [];

        for (const entry of bindgroup.getEntries()) {
            const resource = entry.resource;

            if (resource instanceof BufferInternal) {
                entries.push({
                    binding: entry.binding,
                    resource: {buffer: managers.bufferManager.getRaw(resource.hashProvider.convertToHash())},
                });
            } else if (resource instanceof ImageWrapper) {
                const tracker = managers.textureManager.get(resource.hashProvider.convertToHash(hasher));
                entries.push({
                    binding: entry.binding,
                    resource: tracker.getOrCreateView("2d", {dimension: "2d"}),
                });
            } else {
                entries.push({
                    binding: entry.binding,
                    resource: managers.samplerManager.getRaw(resource.hashProvider.convertToHash(hasher)),
                });
            }
        }

        entries.sort((a, b) => a.binding - b.binding);
        return {label, layout: managers.bindgroupLayoutManager.getRaw(layoutKey), entries};
    }
}
