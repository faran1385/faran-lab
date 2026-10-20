import {MaterialInternal} from "../internals/MaterialInternal.ts";

export class MaterialAdaptor {
    readonly internal: MaterialInternal;

    constructor() {
        this.internal = new MaterialInternal();
    }

}