import {RepresentationHashProvider} from "./RepresentationHashProvider.ts";
import type {BindgroupLayoutEntry} from "../Representations/BindgroupLayoutRepresentation.ts";

type InputFunctions = {
    getEntries: () => Map<number, BindgroupLayoutEntry<any>>,
}

function describeEntry(entry: BindgroupLayoutEntry<any>): string {
    // A layout depends on the kind of resource and, for textures, on the format (it decides the sample type).
    if ("buffer" in entry) return `buffer`;
    if ("sampler" in entry) return `sampler`;
    return `texture:${entry.texture.getFormat()}`;
}

/** Structure only: which binding holds what kind of resource, visible to which stages. Never the resources themselves. */
export class BindgroupLayoutRepresentationHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: () => Array.from(T.getEntries().entries())
                .sort(([a], [b]) => a - b)
                .map(([binding, entry]) => `${binding}:${entry.visibility}:${describeEntry(entry)}`)
                .join("|"),
            getChildrenChangedAt: () => {
                let at = 0;
                for (const entry of T.getEntries().values()) {
                    if ("texture" in entry) at = Math.max(at, entry.texture.hashProvider.getChangedAt());
                }
                return at;
            },
        });
    }
}
