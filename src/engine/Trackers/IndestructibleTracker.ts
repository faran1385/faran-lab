import {type ResourceKind, Tracker} from "./Tracker.ts";

export abstract class IndestructibleTracker<T> extends Tracker<T> {
    constructor(resource: T, kind: ResourceKind) {
        super(resource, kind);
    }
}