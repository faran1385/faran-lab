import {HashHandler} from "./HashHandler.ts";
import type {Hasher} from "./Hasher.ts";

export class AggregateHashHandler extends HashHandler {
    private lastKey: string | null = null;

    convertToHash(hasher: Hasher): string {
        const key = this.buildKey(hasher);
        if (this.cachedHash === null || key !== this.lastKey) {
            this.commitHash(hasher.hashString(key));
            this.lastKey = key;
        }
        return this.cachedHash as string;
    }
}