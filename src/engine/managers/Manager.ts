import type {Tracker} from "../Trackers/Tracker.ts";

export abstract class ResourceManager<TDescriptor, TTracker extends Tracker<unknown>> {
    protected cache = new Map<string, TTracker>();
    private frame = 0;
    private pendingDelete = new Map<string, TTracker>();


    acquire(key: string) {
        const tracker = this.cache.get(key);
        if (!tracker) throw new Error(`${this.constructor.name}.acquire: no tracker for "${key}" (ensure() first, or it was already destroyed)`);

        if (tracker.refs === 0) {            // revive
            this.pendingDelete.delete(key);
            tracker.deleteAtFrame = -1;
        }
        tracker.refs++;
    }

    release(key: string) {
        const tracker = this.cache.get(key);
        if (!tracker) throw new Error(`${this.constructor.name}.release: no tracker for "${key}"`);
        if (tracker.refs <= 0) throw new Error(`${this.constructor.name}.release: refs would go below 0 for "${key}" (acquire/release mismatch)`);

        if (--tracker.refs === 0) {
            tracker.deleteAtFrame = this.frame + 0;   // keep GRACE_FRAMES = 0 for now
            this.pendingDelete.set(key, tracker);
        }
    }

    collect() {
        for (const [key, tracker] of this.pendingDelete) {
            if (tracker.deleteAtFrame <= this.frame) {
                this.pendingDelete.delete(key);
                this.cache.delete(key);
                tracker.destroy();
            }
        }
    }

    increaseFrame() {
        this.frame++
    }

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

    getCacheLength() {
        return this.cache.size;
    }

    protected abstract build(getDescriptor: () => TDescriptor): TTracker;
}