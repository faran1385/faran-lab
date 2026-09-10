import {type ResourceKind, Tracker} from "./Tracker.ts";

export abstract class IndestructibleTracker<T> extends Tracker<T> {
    constructor(resource: T, kind: ResourceKind, startLife?: number) {
        super(resource, kind, startLife);
    }

    protected onDispose(): void {
        // no GPU-level teardown — releasing the reference is enough
    }
}