import {
    type ComponentData,
    type ComponentsMap,
    FragmentAssemblerBase, type FragmentPhase2Output,
    type ValueMap,
    VertexAssemblerBase, type VertexMorph, type VertexPhase2Output, type VertexSkin
} from "../BaseAssembler.ts";

export class BasicVertexAssembler extends VertexAssemblerBase {
    protected vertexPhase2(
        inputValues: ValueMap,
        bindingValues: ValueMap,
        dataMap: Map<string, ComponentData>,
        builtinValues: ValueMap,
        skin?: VertexSkin,
        morph?: VertexMorph,
    ): VertexPhase2Output {
        const position = inputValues.get("position")?.access;
        const normal = inputValues.get("normal")?.access;
        const vertexIndex = builtinValues.get("vertex_index")?.access;
        const viewProjection = `${bindingValues.get("projection")?.access} * ${bindingValues.get("view")?.access}`;

        // Morph targets come first: they move the vertex in model space, on the rest pose. Skinning then deforms the
        // morphed vertex, which is the order glTF defines.
        const morphedPosition = morph && position && vertexIndex ? morph.position(position, vertexIndex) : position;
        const morphedNormal = morph?.normal && normal && vertexIndex ? morph.normal(normal, vertexIndex) : normal;

        // A skinned vertex comes out of the skinning method already in world space: no world matrix on top of it.
        const place = skin
            ? `let skinned = ${skin.call(morphedPosition ?? "vec3f(0.)", morphedNormal ?? "vec3f(0., 1., 0.)")};
            let pos = ${viewProjection} * vec4f(skinned.position, 1.);`
            : `let pos = ${viewProjection} * ${bindingValues.get("worldMatrix")?.access} * vec4f(${morphedPosition}, 1.);`;

        const codeBody = `
            ${place}
        
            return VertexOutput(pos,${dataMap.get("baseColor")?.uv?.access ?? "vec2f(0,0)"});
        `

        return {
            body: codeBody,
            usedBuiltins: morph ? [{name: "vertex_index", type: "u32"}] : [],
            outputs: [{
                type: "vec4f",
                name: "position",
                builtin: "position",
            }, {
                type: "vec2f",
                name: "uv",
                location: 0,
            }]
        }
    }
}

export class BasicFragmentAssembler extends FragmentAssemblerBase {
    protected fragmentPhase2(
        _bindingValues: ValueMap,
        componentsMap: ComponentsMap,
        _builtinValues: ValueMap): FragmentPhase2Output {
        const baseColor = componentsMap.get("baseColor");
        const codeBody = `

            let baseColorTexture=${baseColor?.texture ? `textureSample(${baseColor.texture?.access},${baseColor.sampler?.access},input.uv)` : "vec4f(1.)"};
            let output=vec4f(baseColorTexture.xyz * ${baseColor?.factor?.access ?? "vec3f(1)"}.xyz,1.);

            return FragmentOutput(output);
        `
        return {
            body: codeBody,
            usedBuiltins: [],
            outputs: [{
                type: "vec4f",
                name: "color",
                location: 0
            }],
            expectedFromVertex: [{
                location: 0,
                type: "vec2f",
                name: "uv"
            }]
        }
    }
}
