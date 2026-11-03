import {v4 as uuidv4} from "uuid";
import type {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import type {AnimationInterpolation, AnimationPath} from "../importers/utils/IR.ts";

/** Keyframe data, shared by every channel that uses the same sampler. See IR.AnimationSampler for the layout. */
export interface AnimationSamplerData {
    interpolation: AnimationInterpolation;
    times: Float32Array;
    values: Float32Array;
}

export interface AnimationChannelWrapper {
    target: NodeWrapper;
    path: AnimationPath;
    sampler: AnimationSamplerData;
}

/**
 * One named action ("walk", "run", ...): keyframe channels that target nodes. Data only, nothing here plays or samples
 * it. A clip is not owned by a skin: it may drive several skeletons, or plain nodes, so it lives next to the skin
 * instances in the loader result and is matched to a skin by which joint nodes its channels target.
 */
export class AnimationClipWrapper {
    readonly uuid: string;
    readonly name?: string;
    /** Seconds: the latest keyframe time of any channel. */
    readonly duration: number;

    private readonly channels: readonly AnimationChannelWrapper[];

    constructor(channels: readonly AnimationChannelWrapper[], duration: number, name?: string) {
        this.uuid = uuidv4();
        this.name = name;
        this.duration = duration;
        this.channels = channels;
    }

    getChannels(): readonly AnimationChannelWrapper[] {
        return this.channels;
    }
}
