import {RepresentationHashProvider} from "./RepresentationHashProvider.ts";
import type {BindgroupRepresentation} from "../Representations/BindgroupRepresentation.ts";

type InputFunctions = {
    getGroup: () => number,
    getBindgroup: () => BindgroupRepresentation,
}

/** The material's bind group (and so its layout) and the group index it is bound at. */
export class MaterialInternalHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: (hasher) => `${T.getGroup()}#${T.getBindgroup().hashProvider.convertToHash(hasher)}`,
            getChildrenChangedAt: () => T.getBindgroup().hashProvider.getChangedAt(),
        });
    }
}
