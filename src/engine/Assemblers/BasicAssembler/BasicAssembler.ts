import {
    type ComponentData,
    type ComponentsMap,
    FragmentAssemblerBase, type FragmentPhase2Output,
    type ValueMap,
    VertexAssemblerBase, type VertexPhase2Output
} from "../BaseAssembler.ts";

export class BasicVertexAssembler extends VertexAssemblerBase {
    protected vertexPhase2(
        inputValues: ValueMap,
        bindingValues: ValueMap,
        dataMap: Map<string, ComponentData>,
        _builtinValues: ValueMap,
    ): VertexPhase2Output {
        const codeBody = `
            let pos=${bindingValues.get("projection")?.access} *
             ${bindingValues.get("view")?.access} *
             ${bindingValues.get("worldMatrix")?.access} *
             vec4f(${inputValues.get("position")?.access},1.);
        
            return VertexOutput(pos,${dataMap.get("baseColor")?.uv?.access ?? "vec2f(0,0)"});
        `

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
        }
    }
}

export class BasicFragmentAssembler extends FragmentAssemblerBase {
    protected fragmentPhase2(
        _varyingValues: ValueMap,
        _bindingValues: ValueMap,
        componentsMap: ComponentsMap,
        _builtinValues: ValueMap): FragmentPhase2Output {
        const baseColor = componentsMap.get("baseColor")!;
        const codeBody = `
        
            let baseColorTexture=${baseColor.texture ? `textureSample(${baseColor.texture?.access},${baseColor.sampler?.access},input.uv)` : "vec4f(1.)"};
            let output=vec4f(baseColorTexture.xyz * ${baseColor.factor?.access},1.);
            
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