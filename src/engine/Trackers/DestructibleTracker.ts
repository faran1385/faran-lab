import {type ResourceKind, Tracker} from "./Tracker.ts";

interface Destructible {
    destroy(): void;
}

export abstract class DestructibleTracker<T extends Destructible> extends Tracker<T> {
    constructor(resource: T, kind: ResourceKind, startLife?: number) {
        super(resource, kind, startLife);
    }

    protected onDispose(resource: T): void {
        resource.destroy();
    }
}