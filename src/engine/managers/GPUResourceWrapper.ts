
export abstract class GPUResourceWrapper<T> {
    readonly hash: string;
    protected resource: T;
    protected refCount: number = 0;

    constructor(hash: string, resource: T) {
        this.hash = hash;
        this.resource = resource;
    }

    getResource(): T {
        return this.resource;
    }

    retain(): void {
        this.refCount++;
    }

    release(): void {
        this.refCount--;
    }

    getRefCount(): number {
        return this.refCount;
    }

    abstract dispose(): void;
}