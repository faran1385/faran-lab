import {GeometryInternal} from "../internals/GeometryInternal.ts";


export class GeometryAdaptor {
    readonly internal: GeometryInternal;

    constructor() {
        this.internal = new GeometryInternal();
    }

}