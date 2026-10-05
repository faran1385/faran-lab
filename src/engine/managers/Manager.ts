import type {Tracker} from "../Trackers/Tracker.ts";

export abstract class ResourceManager<TDescriptor, TTracker extends Tracker<unknown>> {
    protected cache = new Map<string, TTracker>();
    private frame = 0;
    private pendingDelete = new Map<string, TTracker>();


    acquire(key: string) {
        const tracker = this.cache.get(key)!;
        if (tracker.refs === 0) {
            this.pendingDelete.delete(key);
            tracker.deleteAtFrame = -1
        }
        tracker.refs++;
    }

    release(key: string) {
        const tracker = this.cache.get(key)!;
        tracker.refs--;
        // grace set to zero for now I'll change it after I make sure the base works fine
        tracker.deleteAtFrame = this.frame + 0
        if (tracker.refs === 0) this.pendingDelete.set(key, tracker);
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