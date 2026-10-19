import { RepresentationHashProvider } from "./RepresentationHashProvider.ts";
import type { BindgroupInteractor } from "../Representations/BindgroupInteractor.ts";

type InputFunctions = {
    getGroup: () => number;
    getBindgroup: () => BindgroupInteractor;
};

/** A material internal is defined by its bind-group slot and the bindings/layout it exposes. */
export class MaterialInternalHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: (hasher) =>
                `group=${T.getGroup()}#bindgroup=${T.getBindgroup().hashProvider.convertToHash(hasher)}`,
            getChildrenChangedAt: () => T.getBindgroup().hashProvider.getChangedAt(),
        });
    }
}
