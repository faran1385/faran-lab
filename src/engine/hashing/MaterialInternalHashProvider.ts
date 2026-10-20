import { RepresentationHashProvider } from "./RepresentationHashProvider.ts";
import { stableKey } from "./utils/stableKey.ts";
import type { BindgroupInteractor } from "../Representations/BindgroupInteractor.ts";
import type { MaterialPipelineSettings } from "../internals/MaterialInternal.ts";

type InputFunctions = {
    getGroup: () => number;
    getBindgroup: () => BindgroupInteractor;
    getPipelineSettings: () => MaterialPipelineSettings;
};

/** A material internal is defined by its bind-group slot, the bindings/layout it exposes and its pipeline settings. */
export class MaterialInternalHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: (hasher) =>
                `group=${T.getGroup()}#bindgroup=${T.getBindgroup().hashProvider.convertToHash(hasher)}#pipeline=${stableKey(T.getPipelineSettings())}`,
            getChildrenChangedAt: () => T.getBindgroup().hashProvider.getChangedAt(),
        });
    }
}
