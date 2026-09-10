export type ResourceKind =
    | "buffer"
    | "texture"
    | "bindGroup"
    | "bindGroupLayout"
    | "sampler"
    | "pipeline"
    | "pipelineLayout"
    | "shaderModule";


export abstract class Tracker<T> {
    protected readonly resource: T;
    readonly kind: ResourceKind;

    private life: number;
    private disposed = false;

    constructor(resource: T, kind: ResourceKind, startLife: number = 1) {
        if (startLife <= 0) {
            throw new Error(`Tracker: startLife must be > 0, got ${startLife}`);
        }
        this.resource = resource;
        this.kind = kind;
        this.life = startLife;
    }

    get raw(): T {
        if (this.disposed) {
            throw new Error(`Tracker(${this.kind}): accessing disposed resource`);
        }
        return this.resource;
    }

    get lifeCount(): number {
        return this.life;
    }

    get isDisposed(): boolean {
        return this.disposed;
    }

    addRef(count: number = 1): number {
        if (this.disposed) {
            throw new Error(`Tracker(${this.kind}): addRef on disposed resource`);
        }
        this.life += count;
        return this.life;
    }

    release(count: number = 1): number {
        if (this.disposed) return this.life;

        this.life -= count;
        if (this.life <= 0) {
            this.dispose();
        }
        return this.life;
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.onDispose(this.resource);
    }

    protected abstract onDispose(resource: T): void;
}