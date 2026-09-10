import type {Hasher} from "../hashing/Hasher.ts";
import type {Tracker} from "../Trackers/Tracker.ts";

export abstract class ResourceManager<TInput, TResource, TTracker extends Tracker<TResource>> {
    protected readonly device: GPUDevice;
    protected readonly hasher: Hasher;
    protected readonly trackers = new Map<string, TTracker>();

    constructor(device: GPUDevice, hasher: Hasher) {
        this.device = device;
        this.hasher = hasher;
    }

    protected createOrGet(input: TInput): TTracker {
        const hash = this.getHash(input);
        const existing = this.trackers.get(hash);
        if (existing) {
            existing.addRef();
            return existing;
        }

        const resource = this.createResource(input);
        const tracker = this.createTracker(resource);

        this.trackers.set(hash, tracker);
        return tracker;
    }

    release(hash: string): void {
        const tracker = this.trackers.get(hash);
        if (!tracker) return;

        tracker.release();
        if (tracker.isDisposed) {
            this.trackers.delete(hash);
        }
    }

    protected abstract getHash(input: TInput): string;
    protected abstract createResource(input: TInput): TResource;
    protected abstract createTracker(resource: TResource): TTracker;
}