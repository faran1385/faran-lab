import {
    type ComponentData,
    type ComponentsMap,
    FragmentAssemblerBase, type FragmentPhase2Output,
    type ValueMap,
    VertexAssemblerBase, type VertexMorph, type VertexPhase2Output, type VertexSkin
} from "../BaseAssembler.ts";
import type {VertexVAT} from "../VATCode.ts";

export class BasicVertexAssembler extends VertexAssemblerBase {
    vertexPhase2(
        inputValues: ValueMap,
        bindingValues: ValueMap,
        dataMap: Map<string, ComponentData>,
        builtinValues: ValueMap,
        skin?: VertexSkin,
        morph?: VertexMorph,
        vat?: VertexVAT
    ): VertexPhase2Output {
        const position = inputValues.get("position")?.access;
        const normal = inputValues.get("normal")?.access;
        const vertexIndex = builtinValues.get("vertex_index")?.access;
        const camera = bindingValues.get("camera")?.access;

        const viewProjection = `${camera}.projection * ${camera}.view`;

        const morphedPosition = morph && position && vertexIndex ? morph.position(position, vertexIndex) : position;
        const morphedNormal = morph?.normal && normal && vertexIndex ? morph.normal(normal, vertexIndex) : normal;

        const vatPosition = vat && vat.position && position && vertexIndex ? vat.position(vertexIndex) : position;


        const place = vatPosition ? `
        let localPosition = ${vat?.position?.(vertexIndex ?? "")}.xyz;
        
        let pos = ${viewProjection}
            * node.worldMatrix
            * vec4f(localPosition, 1.0);
        ` : skin
            ? `let skinned = ${skin.call(morphedPosition ?? "vec3f(0.)", morphedNormal ?? "vec3f(0., 1., 0.)")};
            let pos = ${viewProjection} * vec4f(skinned.position, 1.);`
            : `let pos = ${viewProjection} * ${bindingValues.get("worldMatrix")?.access} * vec4f(${morphedPosition}, 1.);`;

        const codeBody = `
            ${place}
        
            return VertexOutput(pos,${dataMap.get("baseColor")?.uv?.access ?? "vec2f(0,0)"});
        `

        return {
            body: codeBody,
            usedBuiltins: morph || vat ? [{name: "vertex_index", type: "u32"}] : [],
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
    fragmentPhase2(
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
