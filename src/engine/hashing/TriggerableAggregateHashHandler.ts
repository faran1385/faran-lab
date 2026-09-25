import {AggregateHashHandler} from "./AggregateHashHandler.ts";
import type {Hasher} from "./Hasher.ts";

export class TriggerableAggregateHashHandler extends AggregateHashHandler {
    private lastHash: string | null = null;
    private currentHash: string | null = null;

    needsUpdate(hasher: Hasher): boolean {
        this.currentHash = this.convertToHash(hasher);
        return this.currentHash !== this.lastHash;
    }

    sync(): void {
        this.lastHash = this.currentHash;
    }
}