import {ShaderStageRepresentation} from "../Representations/ShaderStageRepresentation.ts";
import {v4 as uuidv4} from "uuid";
import {PrimitiveInternalHashProvider} from "../hashing/PrimitiveInternalHashProvider.ts";
import type {MaterialInternal} from "./MaterialInternal.ts";
import type {GeometryInternal} from "./GeometryInternal.ts";

export class PrimitiveInternal {
    private fragment = new ShaderStageRepresentation();
    private vertex = new ShaderStageRepresentation();
    readonly uuid: string;
    private mat: MaterialInternal;
    private geo: GeometryInternal;
    readonly hashProvider: PrimitiveInternalHashProvider;

    constructor(mat: MaterialInternal, geo: GeometryInternal) {
        this.uuid = uuidv4()
        this.mat = mat;
        this.geo = geo;
        this.hashProvider = new PrimitiveInternalHashProvider({
            getMat: () => this.mat,
            getGeo: () => this.geo,
            getVertex: () => this.vertex,
            getFragment: () => this.fragment,
        });
    }

    getMat(): MaterialInternal {
        return this.mat;
    }

    getGeo(): GeometryInternal {
        return this.geo;
    }

    setMat(material: MaterialInternal): void {
        this.mat = material;
        this.hashProvider.markChanged();
    }

    setGeo(geo: GeometryInternal): void {
        this.geo = geo;
        this.hashProvider.markChanged();
    }

    getFragment() {
        return this.fragment;
    }

    getVertex() {
        return this.vertex;
    }
}