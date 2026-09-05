import type {AccessibleValue} from "../utils.ts";
import {VertexAssemblerBase} from "../VertexShaderAssmblerBase.ts";
import {FragmentAssemblerBase} from "../FragmentAssemblerBase.ts";

export class BasicVertexAssembler extends VertexAssemblerBase {
    protected vertexPhase2(
        inputValues: Record<string, AccessibleValue>,
        bindingValues: Record<string, AccessibleValue>
    ): string {
        const positionAccess = inputValues.position?.access ?? "vec3f(0.0, 0.0, 0.0)";
        const worldMatrix = bindingValues.worldMatrix?.access ?? "mat4x4f()";
        const viewProjection = bindingValues.viewProjection?.access ?? "mat4x4f()";
        return `${viewProjection} * ${worldMatrix} * vec4f(${positionAccess}, 1.0)`;
    }
}

export class BasicFragmentAssembler extends FragmentAssemblerBase {
    protected fragmentPhase2(
        _varyingValues: Record<string, AccessibleValue>,
        bindingValues: Record<string, AccessibleValue>
    ): string {
        return bindingValues.baseColor?.access ?? "vec4f(1.0, 0.0, 1.0, 1.0)";
    }
}