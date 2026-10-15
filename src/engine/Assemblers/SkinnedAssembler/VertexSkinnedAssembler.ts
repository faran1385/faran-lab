import {
    type ComponentData,
    type SkinningValues,
    type ValueMap,
    type VertexPhase2Output,
} from "../BaseAssembler.ts";
import {BasicVertexAssembler} from "../BasicAssembler/BasicAssembler.ts";

/**
 * Vertex assembler for a skinned primitive. The skinning method contributes its WGSL declarations through the
 * descriptor; this assembler decides where to apply the function and intentionally skips the node world matrix,
 * because joint world transforms are already included in the palette.
 */
export class VertexSkinnedAssembler extends BasicVertexAssembler {
    protected vertexPhase2(
        inputValues: ValueMap,
        bindingValues: ValueMap,
        dataMap: Map<string, ComponentData>,
        _builtinValues: ValueMap,
        skinningValues?: SkinningValues,
    ): VertexPhase2Output {
        if (!skinningValues) {
            throw new Error("VertexSkinnedAssembler: no skinning method was supplied in the vertex descriptor");
        }

        const position = inputValues.get("position");
        const joints = inputValues.get("joints0");
        const weights = inputValues.get("weights0");
        if (!position || !joints || !weights) {
            throw new Error("VertexSkinnedAssembler: skinned geometry requires position, joints0, and weights0 attributes");
        }

        const normal = inputValues.get("normal")?.access ?? "vec3f(0.0, 1.0, 0.0)";
        const uv = dataMap.get("baseColor")?.uv?.access ?? "vec2f(0.0, 0.0)";
        const codeBody = `
            let skinned = ${skinningValues.skinFn}(${position.access}, ${normal}, ${joints.access}, ${weights.access});
            let pos = ${bindingValues.get("projection")?.access} *
                      ${bindingValues.get("view")?.access} *
                      vec4f(skinned.position, 1.0);
            return VertexOutput(pos, ${uv});
        `;

        return {
            body: codeBody,
            usedBuiltins: [],
            outputs: [
                {type: "vec4f", name: "position", builtin: "position"},
                {type: "vec2f", name: "uv", location: 0},
            ],
        };
    }
}
