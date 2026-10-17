import {AggregateHashHandler} from "./utils/AggregateHashHandler.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";
import {getEpoch} from "./utils/epoch.ts";
import type {Hasher} from "./utils/Hasher.ts";
import type {BindingEntry} from "../bindings/BindingSet.ts";
import {layoutKeyOf, resourceKeysOf} from "../bindings/describeBinding.ts";

/**
 * Hashing and change tracking for one BindingSet, following the same conventions as every other hash provider:
 * `convertTo*Hash(hasher)` for cache keys, `getChangedAt()` against the global epoch for change detection.
 *
 * Two hashes, because they change for different reasons:
 * - layout: the shape of the bindings (kinds, stages, texture sample types). Swapping a texture for another one of the
 *   same format does not change it, so the layout and everything keyed by it (pipeline layouts, pipelines) survive.
 * - bind group: the layout plus the actual resources. Swapping a resource changes it, and only it.
 */
export class BindingSetHashProvider {
    private readonly changeStamp = new ChangeStamp();
    private memoEpoch = -1;
    private memoChangedAt = 0;
    private readonly getEntries: () => readonly BindingEntry[];
    private readonly layoutHash: AggregateHashHandler;
    private readonly bindgroupHash: AggregateHashHandler;

    constructor(getEntries: () => readonly BindingEntry[]) {
        this.getEntries = getEntries;
        this.layoutHash = new AggregateHashHandler(() => layoutKeyOf(getEntries()));
        this.bindgroupHash = new AggregateHashHandler((hasher) => {
            const entries = getEntries();
            const resources = resourceKeysOf(entries, hasher).map((r) => `${r.binding}=${r.kind}:${r.key}`);
            return `${layoutKeyOf(entries)}#${resources.join("|")}`;
        });
    }

    /** Latest change stamp of this set or of anything bound in it. Memoized per epoch, like the material's. */
    getChangedAt(): number {
        const epoch = getEpoch();
        if (this.memoEpoch === epoch) return this.memoChangedAt;

        let at = this.changeStamp.get();
        for (const entry of this.getEntries()) {
            const valueAt = entry.value.hashProvider.getChangedAt();
            if (valueAt > at) at = valueAt;
        }

        this.memoEpoch = epoch;
        this.memoChangedAt = at;
        return at;
    }

    markChangeStamp(): void {
        this.changeStamp.mark();
    }

    convertToLayoutHash(hasher: Hasher): string {
        return this.layoutHash.convertToHash(hasher);
    }

    convertToBindgroupHash(hasher: Hasher): string {
        return this.bindgroupHash.convertToHash(hasher);
    }
}
