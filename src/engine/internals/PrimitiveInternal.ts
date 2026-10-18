import {ShaderStageRepresentation} from "../Representations/ShaderStageRepresentation.ts";

export class PrimitiveInternal {
    private fragment = new ShaderStageRepresentation();
    private vertex = new ShaderStageRepresentation();

    getFragment() {
        return this.fragment;
    }

    getVertex() {
        return this.vertex;
    }
}