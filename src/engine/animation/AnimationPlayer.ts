import {v4 as uuidv4} from "uuid";
import {quat} from "../../packages/math/quat/quat.ts";
import type {AnimationChannelWrapper, AnimationClipWrapper} from "./AnimationClipWrapper.ts";

export type LoopMode = "once" | "repeat" | "pingpong";

/**
 * Plays one AnimationClipWrapper: owns the playhead and, every update, samples each channel and writes the result into
 * its target node's translation / rotation / scale. Nothing else: it knows nothing about skins or the renderer. The
 * skin palette follows by itself, because writing a joint's TRS marks its subtree dirty and the palette write is keyed
 * on the joints' world versions.
 *
 * Call `update(deltaSeconds)` once per frame, before `renderer.render`.
 *
 * Deliberately not here yet: blending several clips (crossfade, layers). A node driven by two playing players gets
 * whichever updated last.
 */
export class AnimationPlayer {
    readonly uuid: string;

    loop: LoopMode = "repeat";
    /** Playback rate. Negative plays backwards. */
    speed = 1;
    /** Called once when a "once" clip reaches its end (or its start, when playing backwards). */
    onFinished?: () => void;

    private clip: AnimationClipWrapper;
    private playing = false;
    private finished = false;
    /** Unwrapped playhead in seconds: not folded into [0, duration], so pingpong can derive its direction. */
    private playhead = 0;

    /** Per channel: the keyframe index found last time. Playback is mostly sequential, so the next lookup starts there. */
    private readonly lastKey: Int32Array;
    private readonly scratchA = new Float32Array(4);
    private readonly scratchB = new Float32Array(4);
    private readonly scratchOut = new Float32Array(4);

    constructor(clip: AnimationClipWrapper) {
        this.uuid = uuidv4();
        this.clip = clip;
        this.lastKey = new Int32Array(clip.getChannels().length);
    }

    // -- transport ---------------------------------------------------------

    /** Starts (or resumes) playing. A finished "once" clip restarts from the beginning. */
    play(): void {
        if (this.finished) this.seek(this.speed < 0 ? this.clip.duration : 0);
        this.playing = true;
    }

    pause(): void {
        this.playing = false;
    }

    /** Pauses and rewinds, and writes the first frame so the pose snaps back. */
    stop(): void {
        this.playing = false;
        this.seek(0);
    }

    /** Moves the playhead to `seconds` (in clip time) and applies that pose immediately, playing or not. */
    seek(seconds: number): void {
        this.playhead = seconds;
        this.finished = false;
        this.apply();
    }

    isPlaying(): boolean {
        return this.playing;
    }

    isFinished(): boolean {
        return this.finished;
    }

    getClip(): AnimationClipWrapper {
        return this.clip;
    }

    /** Current time inside the clip, [0, duration], with loop mode applied. */
    getTime(): number {
        return this.clipTime();
    }

    /** Normalized progress, [0, 1]. */
    getProgress(): number {
        const d = this.clip.duration;
        return d > 0 ? this.clipTime() / d : 0;
    }

    // -- per frame ---------------------------------------------------------

    update(deltaSeconds: number): void {
        if (!this.playing) return;

        const duration = this.clip.duration;
        if (duration <= 0) return;

        this.playhead += deltaSeconds * this.speed;

        if (this.loop === "once") {
            const atEnd = this.playhead >= duration;
            const atStart = this.playhead <= 0;
            if ((this.speed > 0 && atEnd) || (this.speed < 0 && atStart)) {
                this.playhead = atEnd ? duration : 0;
                this.apply();
                this.playing = false;
                this.finished = true;
                this.onFinished?.();
                return;
            }
        }

        this.apply();
    }

    // -- sampling ----------------------------------------------------------

    private clipTime(): number {
        const duration = this.clip.duration;
        if (duration <= 0) return 0;
        const t = this.playhead;

        switch (this.loop) {
            case "once":
                return Math.min(Math.max(t, 0), duration);
            case "repeat":
                return ((t % duration) + duration) % duration;
            case "pingpong": {
                const m = ((t % (2 * duration)) + 2 * duration) % (2 * duration);
                return m <= duration ? m : 2 * duration - m;
            }
        }
    }

    private apply(): void {
        const time = this.clipTime();
        const channels = this.clip.getChannels();
        for (let i = 0; i < channels.length; i++) {
            this.applyChannel(i, channels[i], time);
        }
    }

    private applyChannel(index: number, channel: AnimationChannelWrapper, time: number): void {
        const {times, values, interpolation} = channel.sampler;
        const count = times.length;
        if (count === 0) return;

        const isRotation = channel.path === "rotation";
        const comps = isRotation ? 4 : 3;
        const out = this.scratchOut;
        const cubic = interpolation === "cubicspline";
        // Value of keyframe k starts at this offset. cubicspline stores (in-tangent, value, out-tangent) per key.
        const valueAt = (k: number) => (cubic ? k * 3 + 1 : k) * comps;

        let k0: number;
        let k1: number;
        let s = 0;

        if (count === 1 || time <= times[0]) {
            k0 = k1 = 0;
        } else if (time >= times[count - 1]) {
            k0 = k1 = count - 1;
        } else {
            k0 = this.findKey(index, times, time);
            k1 = k0 + 1;
            s = (time - times[k0]) / (times[k1] - times[k0]);
        }

        if (k0 === k1 || interpolation === "step" || s === 0) {
            const o = valueAt(k0);
            for (let c = 0; c < comps; c++) out[c] = values[o + c];
        } else if (!cubic) {
            const o0 = valueAt(k0);
            const o1 = valueAt(k1);
            if (isRotation) {
                for (let c = 0; c < 4; c++) {
                    this.scratchA[c] = values[o0 + c];
                    this.scratchB[c] = values[o1 + c];
                }
                quat.slerp(out, this.scratchA, this.scratchB, s);
            } else {
                for (let c = 0; c < 3; c++) out[c] = values[o0 + c] + (values[o1 + c] - values[o0 + c]) * s;
            }
        } else {
            // glTF cubic Hermite: tangents are scaled by the keyframe interval.
            const td = times[k1] - times[k0];
            const s2 = s * s;
            const s3 = s2 * s;
            const h00 = 2 * s3 - 3 * s2 + 1;
            const h10 = s3 - 2 * s2 + s;
            const h01 = -2 * s3 + 3 * s2;
            const h11 = s3 - s2;
            const v0 = valueAt(k0);
            const v1 = valueAt(k1);
            const outTangent0 = v0 + comps;   // out-tangent of k0 follows its value
            const inTangent1 = v1 - comps;    // in-tangent of k1 precedes its value
            for (let c = 0; c < comps; c++) {
                out[c] = h00 * values[v0 + c] + h10 * td * values[outTangent0 + c]
                       + h01 * values[v1 + c] + h11 * td * values[inTangent1 + c];
            }
            if (isRotation) quat.normalize(out, out);
        }

        const node = channel.target;
        switch (channel.path) {
            case "translation":
                node.setTranslation(out[0], out[1], out[2]);
                break;
            case "scale":
                node.setScale(out[0], out[1], out[2]);
                break;
            case "rotation":
                node.setRotationQuat(out[0], out[1], out[2], out[3]);
                break;
        }
    }

    /** Largest k with times[k] <= time, for times[0] < time < times[last]. Starts from the previous result. */
    private findKey(channelIndex: number, times: Float32Array, time: number): number {
        let k = this.lastKey[channelIndex];

        if (k < 0 || k >= times.length - 1 || time < times[k]) {
            // Playhead jumped backwards (loop wrap, seek, reverse): binary search the whole track.
            let lo = 0;
            let hi = times.length - 1;
            while (hi - lo > 1) {
                const mid = (lo + hi) >> 1;
                if (times[mid] <= time) lo = mid; else hi = mid;
            }
            k = lo;
        } else {
            while (k < times.length - 2 && time >= times[k + 1]) k++;
        }

        this.lastKey[channelIndex] = k;
        return k;
    }
}
