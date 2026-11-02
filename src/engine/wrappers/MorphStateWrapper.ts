import {v4 as uuidv4} from "uuid";
import {MorphStateAdaptor} from "../Adaptors/MorphStateAdaptor.ts";
import {MORPH_MAX_ACTIVE} from "../producers/MorphProducer.ts";
import type {MorphTargetWrapper} from "./MorphTargetWrapper.ts";

export interface MorphStateOptions {
    /** One name per target, in target order; lets `setWeight("smile", 1)` work. */
    names?: readonly string[];
    /** Initial weights, one per target. Default all 0. */
    weights?: ArrayLike<number>;
    /**
     * At most this many targets are applied at once (the strongest ones); the rest are ignored. The shader loops over
     * the active ones only, so this is also the per-vertex cost ceiling. Default 8. Fixed at construction.
     */
    maxActive?: number;
    /** |weight| at or below this counts as 0 and is not applied. Default 1e-5 */
    epsilon?: number;
}

/**
 * The weights of one node's morph targets (mesh instance state, as opposed to MorphTargetWrapper, which is the shared
 * geometry data). Give it to a node with `node.setMorphState(state)`; two nodes can have different expressions even
 * though they draw the same geometry.
 *
 * Setting a weight is cheap and does no GPU work: the list of active targets is rebuilt once, before the next frame.
 * `update()` does it right now.
 */
export class MorphStateWrapper {
    readonly uuid: string;
    readonly adaptor: MorphStateAdaptor;

    private readonly weights: Float32Array;
    private readonly names: readonly string[] | undefined;
    private readonly indexByName = new Map<string, number>();
    private readonly maxActive: number;
    private readonly epsilon: number;

    constructor(targetCount: number, options: MorphStateOptions = {}) {
        if (!Number.isInteger(targetCount) || targetCount < 1) {
            throw new RangeError(`MorphStateWrapper: targetCount must be a positive integer, got ${targetCount}`);
        }
        const maxActive = options.maxActive ?? MORPH_MAX_ACTIVE;
        if (!Number.isInteger(maxActive) || maxActive < 1) {
            throw new RangeError(`MorphStateWrapper: maxActive must be a positive integer, got ${maxActive}`);
        }

        this.uuid = uuidv4();
        this.maxActive = maxActive;
        this.epsilon = options.epsilon ?? 1e-5;
        this.weights = new Float32Array(targetCount);

        if (options.weights) {
            if (options.weights.length !== targetCount) {
                throw new RangeError(`MorphStateWrapper: ${options.weights.length} weights for ${targetCount} targets`);
            }
            this.weights.set(options.weights);
        }

        this.names = options.names;
        if (this.names) {
            if (this.names.length !== targetCount) {
                throw new RangeError(`MorphStateWrapper: ${this.names.length} names for ${targetCount} targets`);
            }
            this.names.forEach((name, index) => this.indexByName.set(name, index));
        }

        this.adaptor = new MorphStateAdaptor(this, maxActive);
    }

    /** A state for these targets, with their names. */
    static fromTargets(targets: MorphTargetWrapper, options: Omit<MorphStateOptions, "names"> = {}): MorphStateWrapper {
        return new MorphStateWrapper(targets.getTargetCount(), {...options, names: targets.getTargetNames()});
    }

    getTargetCount(): number {
        return this.weights.length;
    }

    getMaxActive(): number {
        return this.maxActive;
    }

    getEpsilon(): number {
        return this.epsilon;
    }

    getTargetNames(): readonly string[] | undefined {
        return this.names;
    }

    /** The live weights. If you write into this array yourself, call `update()` afterwards. */
    getWeights(): Float32Array {
        return this.weights;
    }

    getWeight(target: number | string): number {
        return this.weights[this.resolve(target)];
    }

    setWeight(target: number | string, weight: number): void {
        this.weights[this.resolve(target)] = weight;
        this.adaptor.invalidate();
    }

    /** Replaces all weights; `weights` needs one value per target. */
    setWeights(weights: ArrayLike<number>): void {
        if (weights.length !== this.weights.length) {
            throw new RangeError(`MorphStateWrapper.setWeights: ${weights.length} weights for ${this.weights.length} targets`);
        }
        this.weights.set(weights);
        this.adaptor.invalidate();
    }

    /**
     * Applies the current weights to the buffer the node binds, now instead of before the next frame. The buffer is
     * uploaded with the rest of the frame's changes either way.
     */
    update(): void {
        this.adaptor.invalidate();
        this.adaptor.ensure();
    }

    private resolve(target: number | string): number {
        const index = typeof target === "string" ? this.indexByName.get(target) : target;
        if (index === undefined || !Number.isInteger(index) || index < 0 || index >= this.weights.length) {
            throw new RangeError(`MorphStateWrapper: no morph target ${typeof target === "string" ? `named "${target}"` : `at index ${target}`} (${this.weights.length} targets)`);
        }
        return index;
    }
}
