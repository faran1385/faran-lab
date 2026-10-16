import {
    type ComponentData,
    type ValueMap,
    VertexAssemblerBase,
    type VertexPhase2Output
} from "../BaseAssembler.ts";

/**
 * Vertex assembler for primitives of skinned nodes. It is independent of the skinning method: LBS, DQS or any other
 * SkinningMethod contributes the `skinFn` that phase 1 declares, and this class only calls it.
 *
 * The skinned position is already in world space (the palette holds jointWorld * inverseBind), so the node's own
 * world matrix is deliberately not applied. Its outputs (clip position + uv) match BasicVertexAssembler's, so it pairs
 * with the same fragment assemblers.
 */
export class VertexSkinnedAssembler extends VertexAssemblerBase {
    protected vertexPhase2(
        _inputValues: ValueMap,
        bindingValues: ValueMap,
        dataMap: Map<string, ComponentData>,
        _builtinValues: ValueMap,
    ): VertexPhase2Output {
        const codeBody = `
            let skinned=skin(${_inputValues.get("position")?.access},${_inputValues.get("normal")?.access},${_inputValues.get("joints0")?.access},${_inputValues.get("weights0")?.access});
            let pos = ${bindingValues.get("projection")?.access} *
             ${bindingValues.get("view")?.access} *
             vec4f(skinned.position, 1.);

            return VertexOutput(pos, ${dataMap.get("baseColor")?.uv?.access ?? "vec2f(0,0)"});
        `;

        return {
            body: codeBody,
            usedBuiltins: [],
            outputs: [{
                type: "vec4f",
                name: "position",
                builtin: "position",
            }, {
                type: "vec2f",
                name: "uv",
                location: 0,
            }]
        };
    }
}
