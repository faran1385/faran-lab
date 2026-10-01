import type {Hasher} from "./Hasher.ts";
import type {Hashable} from "./AggregateHashHandler.ts";

export class HashHandler implements Hashable {
    private version = 0;
    protected cachedHash: string | null = null;
    private cachedHashVersion = -1;
    protected buildKey: (...args: any[]) => string;

    constructor(buildKey: (...args: any[]) => string) {
        this.buildKey = buildKey;
    }

    addVersion(): void { this.version++; }
    getVersion(): number { return this.version; }

    setBuildKey(buildKey: (...args: any[]) => string): void {
        this.buildKey = buildKey;
        this.cachedHash = null;
        this.cachedHashVersion = -1;
    }

    convertToHash(hasher: Hasher): string {
        if (this.cachedHash === null || this.cachedHashVersion !== this.version) {
            this.cachedHash = hasher.hashString(this.buildKey(hasher));
            this.cachedHashVersion = this.version;
        }
        return this.cachedHash;
    }
}