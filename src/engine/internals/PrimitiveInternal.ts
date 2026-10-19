import {ShaderStageRepresentation} from "../Representations/ShaderStageRepresentation.ts";
import {v4 as uuidv4} from "uuid";
import type {MaterialInternal} from "./MaterialInternal.ts";
import type {GeometryInternal} from "./GeometryInternal.ts";

export class PrimitiveInternal {
    private fragment = new ShaderStageRepresentation();
    private vertex = new ShaderStageRepresentation();
    readonly uuid: string;
    private mat: MaterialInternal;
    private geo: GeometryInternal;

    constructor(mat: MaterialInternal, geo: GeometryInternal) {
        this.uuid = uuidv4()
        this.mat = mat;
        this.geo = geo;
    }

    getMat(): MaterialInternal {
        return this.mat;
    }

    getGeo(): GeometryInternal {
        return this.geo;
    }

    setMat(material: MaterialInternal): void {
        this.mat = material;
    }

    setGeo(geo: GeometryInternal): void {
        this.geo = geo;
    }

    getFragment() {
        return this.fragment;
    }

    getVertex() {
        return this.vertex;
    }
}