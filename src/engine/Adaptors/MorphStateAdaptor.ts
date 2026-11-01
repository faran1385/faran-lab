import {MorphStateInternal} from "../internals/MorphStateInternal.ts";
import {MORPH_ACTIVE_ENTRY_BYTES} from "../producers/MorphProducer.ts";
import {schedulePreFrame} from "./PreFrameQueue.ts";
import type {MorphStateWrapper} from "../wrappers/MorphStateWrapper.ts";

/**
 * Translates a MorphStateWrapper: turns its weights into the short list of active targets the vertex shader loops over.
 *
 * Only targets whose weight is not (almost) zero are written, strongest first, at most `maxActive` of them, and the
 * entries after the last one are zeroed (weight 0 ends the loop in the shader). A face rig with 52 targets and five
 * active expressions therefore costs five iterations and a 64-byte upload, not 52 iterations.
 *
 * Setters only call `invalidate()`; the list is rebuilt once, in the pre-frame queue, from the final weights. The buffer
 * is edited in place and queued for upload: its identity never changes, so no pipeline or bind group is rebuilt.
 */
export class MorphStateAdaptor {
    readonly internal: MorphStateInternal;

    private readonly owner: MorphStateWrapper;
    private readonly maxActive: number;
    private readonly asU32: Uint32Array;
    private readonly asF32: Float32Array;
    private readonly task = () => this.ensure();
    private dirty = true;

    constructor(owner: MorphStateWrapper, maxActive: number) {
        this.owner = owner;
        this.maxActive = maxActive;
        this.internal = new MorphStateInternal(maxActive);

        const bytes = this.internal.activeBuffer.getData();
        // one entry = u32 index + f32 weight, both written through views over the same bytes
        this.asU32 = new Uint32Array(bytes);
        this.asF32 = new Float32Array(bytes);
        schedulePreFrame(this.task);
    }

    invalidate(): void {
        this.dirty = true;
        schedulePreFrame(this.task);
    }

    ensure(): void {
        if (!this.dirty) return;
        this.dirty = false;

        const weights = this.owner.getWeights();
        const epsilon = this.owner.getEpsilon();

        const active: number[] = [];
        for (let i = 0; i < weights.length; i++) {
            // NaN fails the comparison, so a NaN weight is skipped like a zero one
            if (Math.abs(weights[i]) > epsilon) active.push(i);
        }
        if (active.length > this.maxActive) {
            active.sort((a, b) => Math.abs(weights[b]) - Math.abs(weights[a]));
            active.length = this.maxActive;
        }

        const stride = MORPH_ACTIVE_ENTRY_BYTES / 4;
        for (let slot = 0; slot < this.maxActive; slot++) {
            const target = slot < active.length ? active[slot] : -1;
            this.asU32[slot * stride] = target >= 0 ? target : 0;
            this.asF32[slot * stride + 1] = target >= 0 ? weights[target] : 0;
        }

        this.internal.activeBuffer.markDirty();
    }
}
