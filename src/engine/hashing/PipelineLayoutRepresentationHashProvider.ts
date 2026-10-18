import {RepresentationHashProvider} from "./RepresentationHashProvider.ts";
import type {BindgroupLayoutRepresentation} from "../Representations/BindgroupLayoutRepresentation.ts";

type InputFunctions = {
    getLayouts: () => Map<number, BindgroupLayoutRepresentation>,
}

/** Which bind group layout sits at which group index. */
export class PipelineLayoutRepresentationHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: (hasher) => Array.from(T.getLayouts().entries())
                .sort(([a], [b]) => a - b)
                .map(([group, layout]) => {
                    layout.hashProvider.update(hasher);
                    return `${group}:${layout.hashProvider.current}`;
                })
                .join("|"),
            getChildrenChangedAt: () => {
                let at = 0;
                for (const layout of T.getLayouts().values()) at = Math.max(at, layout.hashProvider.getChangedAt());
                return at;
            },
        });
    }
}
