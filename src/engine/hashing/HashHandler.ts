import type {Hasher} from "./Hasher.ts";

export class HashHandler {
    private version: number = 0;
    protected  cachedHash: string | null = null;
    private cachedHashVersion: number = -1;
    private trash: string[] = [];
    protected readonly buildKey: (...args:any[]) => string

    constructor(buildKey: (...args:any[]) => string) {
        this.buildKey = buildKey;
    }

    addVersion(): void {
        this.version++;
    }

    getVersion(): number {
        return this.version;
    }

    convertToHash(hasher: Hasher): string {
        if (this.cachedHash === null || this.cachedHashVersion !== this.version) {
            this.commitHash(hasher.hashString(this.buildKey(hasher)));
            this.cachedHashVersion = this.version;
        }
        return this.cachedHash as string;
    }

    protected commitHash(newHash: string): void {
        if (this.cachedHash !== null && this.cachedHash !== newHash) {
            this.trash.push(this.cachedHash);
        }
        this.cachedHash = newHash;
    }

    drainTrash(): string[] {
        const t = this.trash;
        this.trash = [];
        return t;
    }
}