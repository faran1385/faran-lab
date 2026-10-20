import {MaterialInternal} from "../internals/MaterialInternal.ts";
import type {MaterialFactorsPlan} from "../producers/utils.ts";


export class MaterialAdaptor {
    readonly internal: MaterialInternal;
    private cachedMaterialFactorsPlan: MaterialFactorsPlan;

    constructor() {
        this.internal = new MaterialInternal();
    }

    onMaterialComponentChange() {

    }

    setMaterialComponent() {

    }

    removeMaterialComponent() {

    }

}