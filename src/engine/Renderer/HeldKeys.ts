import type {CentralManager} from "../managers/CentralManager.ts";
import type {ResourceManager} from "../managers/Manager.ts";
import type {Tracker} from "../Trackers/Tracker.ts";

/**
 * The resources one node's render items depend on, as manager keys. Items hold references to every resource they
 * touched, transitively (a bind group's buffers and textures, a pipeline's layouts and modules), so a resource lives
 * exactly as long as some cached item needs it.
 */
export interface HeldKeys {
    buffers: Set<string>;
    textures: Set<string>;
    samplers: Set<string>;
    bindgroupLayouts: Set<string>;
    bindgroups: Set<string>;
    pipelineLayouts: Set<string>;
    shaderModules: Set<string>;
    pipelines: Set<string>;
}

export function emptyHeldKeys(): HeldKeys {
    return {
        buffers: new Set(),
        textures: new Set(),
        samplers: new Set(),
        bindgroupLayouts: new Set(),
        bindgroups: new Set(),
        pipelineLayouts: new Set(),
        shaderModules: new Set(),
        pipelines: new Set(),
    };
}

function pairs(managers: CentralManager, keys: HeldKeys): [ResourceManager<any, Tracker<unknown>>, Set<string>][] {
    return [
        [managers.bufferManager, keys.buffers],
        [managers.textureManager, keys.textures],
        [managers.samplerManager, keys.samplers],
        [managers.bindgroupLayoutManager, keys.bindgroupLayouts],
        [managers.bindgroupManager, keys.bindgroups],
        [managers.pipelineLayoutManager, keys.pipelineLayouts],
        [managers.shaderModuleManager, keys.shaderModules],
        [managers.pipelineManager, keys.pipelines],
    ];
}

/** Every key must have been ensured first. */
export function acquireHeld(managers: CentralManager, keys: HeldKeys): void {
    for (const [manager, set] of pairs(managers, keys)) for (const key of set) manager.acquire(key);
}

export function releaseHeld(managers: CentralManager, keys: HeldKeys): void {
    for (const [manager, set] of pairs(managers, keys)) for (const key of set) manager.release(key);
}
