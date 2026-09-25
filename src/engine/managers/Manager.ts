import type {Tracker} from "../Trackers/Tracker.ts";

export abstract class ResourceManager<TDescriptor, TTracker extends Tracker<unknown>> {
    protected cache = new Map<string, TTracker>();

    ensure(hash: string, getDescriptor: () => TDescriptor): void {
        if (this.cache.has(hash)) return;
        this.cache.set(hash, this.build(getDescriptor));
    }

    get(hash: string): TTracker {
        const tracker = this.cache.get(hash);
        if (!tracker) throw new Error(`No resource for hash ${hash}, did you forget ensure()?`);
        return tracker;
    }

    getRaw(hash: string): TTracker["raw"] {
        return this.get(hash).raw;
    }

    protected abstract build(getDescriptor: () => TDescriptor): TTracker;
}