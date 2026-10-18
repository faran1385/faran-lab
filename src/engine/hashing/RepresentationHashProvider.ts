import type {Hasher} from "./utils/Hasher.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";

type InputFunctions = {
    /** Builds the key to hash. Must call `update(hasher)` on every child representation it reads, before reading their `current`. */
    buildKey: (hasher: Hasher) => string,
    /** Latest change stamp of everything this hash is built from, excluding this provider's own stamp. */
    getChildrenChangedAt?: () => number,
}

/**
 * Hash of one representation, with `previous` (the hash the GPU resource was last reconciled for) and `current`.
 *
 * Setters only call `markChanged()`, which moves a stamp. Nothing is hashed until `update(hasher)` runs inside the
 * frame, and `update` rebuilds only when the own stamp or a child's stamp is newer than the one it last built at.
 * So set(T1) followed by set(T2) costs one hash, and a quiet representation costs one number comparison.
 */
export class RepresentationHashProvider {
    private readonly changeStamp = new ChangeStamp();
    private readonly buildKey: InputFunctions["buildKey"];
    private readonly getChildrenChangedAt: () => number;
    private builtAt = -1;
    private _previous: string | null = null;
    private _current: string | null = null;

    constructor(T: InputFunctions) {
        this.buildKey = T.buildKey;
        this.getChildrenChangedAt = T.getChildrenChangedAt ?? (() => 0);
    }

    get previous(): string | null {
        return this._previous;
    }

    get current(): string | null {
        return this._current;
    }

    markChanged(): void {
        this.changeStamp.mark();
    }

    getChangedAt(): number {
        return Math.max(this.changeStamp.get(), this.getChildrenChangedAt());
    }

    /** Recomputes `current` when something it depends on changed. Returns true if the hash value itself changed. */
    update(hasher: Hasher): boolean {
        const changedAt = this.getChangedAt();
        if (this._current !== null && changedAt <= this.builtAt) return false;

        const next = hasher.hashString(this.buildKey(hasher));
        this.builtAt = changedAt;
        const changed = next !== this._current;
        this._current = next;
        return changed;
    }

    /** True when `current` differs from what was last committed, i.e. the GPU side needs reconciling. */
    hasPending(): boolean {
        return this._current !== this._previous;
    }

    /** Called by the reconciler after it has built / acquired the resource for `current`. */
    commit(): void {
        this._previous = this._current;
    }

    /** Forgets the committed hash so the next reconcile treats the resource as new (e.g. after it was released). */
    invalidate(): void {
        this._previous = null;
    }
}
