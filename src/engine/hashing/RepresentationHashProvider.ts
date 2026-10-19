import type {Hasher} from "./utils/Hasher.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";

type InputFunctions = {
    /** Builds the key to hash. Read children through their `hashProvider.convertToHash(hasher)`. */
    buildKey: (hasher: Hasher) => string,
    /** Latest change stamp of everything this hash is built from, excluding this provider's own stamp. */
    getChildrenChangedAt?: () => number,
}

/**
 * Holds the current hash of one representation or internal. The previous hash is not kept here: like the rest of the
 * engine it lives in the render cache's hashData, and whoever reconciles compares the two.
 *
 * Setters only call `markChanged()`, which moves a stamp. Nothing is hashed until `convertToHash(hasher)` runs inside
 * the frame, and it rebuilds only when the own stamp or a child's stamp is newer than the one it last built at.
 * So set(T1) followed by set(T2) costs one hash, and an unchanged provider costs one number comparison.
 */
export class RepresentationHashProvider {
    private readonly changeStamp = new ChangeStamp();
    private readonly buildKey: InputFunctions["buildKey"];
    private readonly getChildrenChangedAt: () => number;
    private builtAt = -1;
    private cachedHash: string | null = null;

    constructor(T: InputFunctions) {
        this.buildKey = T.buildKey;
        this.getChildrenChangedAt = T.getChildrenChangedAt ?? (() => 0);
    }

    markChanged(): void {
        this.changeStamp.mark();
    }

    /** Latest change stamp of this provider or of anything it is built from. */
    getChangedAt(): number {
        return Math.max(this.changeStamp.get(), this.getChildrenChangedAt());
    }

    convertToHash(hasher: Hasher): string {
        const changedAt = this.getChangedAt();
        if (this.cachedHash === null || changedAt > this.builtAt) {
            this.cachedHash = hasher.hashString(this.buildKey(hasher));
            this.builtAt = changedAt;
        }
        return this.cachedHash;
    }
}
