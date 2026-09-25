import type {Hasher} from "./Hasher.ts";

export interface Hashable {
    convertToHash(hasher: Hasher): string;
}

export class AggregateHashHandler implements Hashable {
    private cachedHash: string | null = null;
    private lastKey: string | null = null;
    private readonly buildKey: (hasher: Hasher) => string;

    constructor(buildKey: (hasher: Hasher) => string) {
        this.buildKey = buildKey;
    }

    convertToHash(hasher: Hasher): string {
        const key = this.buildKey(hasher);
        if (this.cachedHash === null || key !== this.lastKey) {
            this.cachedHash = hasher.hashString(key);
            this.lastKey = key;
        }
        return this.cachedHash;
    }
}