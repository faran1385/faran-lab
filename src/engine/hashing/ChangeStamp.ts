import {bumpEpoch} from "./epoch.ts";

/**
 * Records "when was I last changed" as a value of the global epoch.
 *
 * Unlike a dirty flag it is never cleared. Every consumer compares the stamp with the epoch it built at, so a
 * wrapper shared by many consumers (one material on 100 primitives) is seen as changed by all of them.
 */
export class ChangeStamp {
    private at = 0;

    mark(): void {
        this.at = bumpEpoch();
    }

    get(): number {
        return this.at;
    }
}
