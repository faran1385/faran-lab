import type {
    FragmentShaderDescriptor,
    VertexShaderDescriptor
} from "../producers/AssemblerProducers.ts";
import {buildBindingDecls} from "./utils.ts";
import type {WGSLType} from "../producers/utils.ts";

type AccessibleValue = { type: WGSLType; access: string };
export type ValueMap = Map<string, AccessibleValue>;

type ComponentAccess = {
    factor?: AccessibleValue;
    texture?: AccessibleValue;
    sampler?: AccessibleValue;
    uv?: AccessibleValue;
};


export type ComponentData = {
    uv?: AccessibleValue;
}

export type ComponentsMap = Map<string, ComponentAccess>;

export type UsedBuiltin = { name: string; type: WGSLType };

const VERTEX_INPUT_BUILTINS: UsedBuiltin[] = [
    {name: "vertex_index", type: "u32"},
    {name: "instance_index", type: "u32"},
];

const FRAGMENT_INPUT_BUILTINS: UsedBuiltin[] = [
    {name: "front_facing", type: "bool"},
    {name: "sample_index", type: "u32"},
    {name: "sample_mask", type: "u32"},
];

function toValueMap(record: Record<string, AccessibleValue>): ValueMap {
    return new Map(Object.entries(record));
}

function buildComponentsMap(
    componentDataMap: FragmentShaderDescriptor["componentDataMap"],
    bindingValues: ValueMap,
    uvSource: ValueMap,
): ComponentsMap {
    const map: ComponentsMap = new Map();

    componentDataMap.forEach((data, componentName) => {
        const entry: ComponentAccess = {};

        if (data.hasFactor) {
            const value = bindingValues.get(componentName);
            if (value) entry.factor = value;
        }
        if (data.textureBindingName) {
            const value = bindingValues.get(data.textureBindingName);
            if (value) entry.texture = value;
        }
        if (data.samplerBindingName) {
            const value = bindingValues.get(data.samplerBindingName);
            if (value) entry.sampler = value;
        }
        if (data.texCoord) {
            const uv = uvSource.get(data.texCoord);
            if (uv) entry.uv = uv;
        }

        map.set(componentName, entry);
    });

    return map;
}

export type OutputFieldDecl = { name: string, type: WGSLType, location: number } |
    { name: string, type: WGSLType, builtin: string }

function renderStruct(structName: string, fields: OutputFieldDecl[]): string {
    const lines = fields.map((f) =>
        "builtin" in f ? `  @builtin(${f.builtin}) ${f.name}: ${f.type},`
            : `  @location(${f.location}) ${f.name}: ${f.type},`
    );
    return `struct ${structName} {\n${lines.join("\n")}\n};`;
}

export type VertexPhase2Output = { body: string; usedBuiltins: UsedBuiltin[]; outputs: OutputFieldDecl[] }

export abstract class VertexAssemblerBase {
    assemble(d: VertexShaderDescriptor, entryPoint: string): string {
        const {preamble, inputValues, bindingValues, dataMap, builtinValues} = this.vertexPhase1(d);
        const {
            body,
            usedBuiltins,
            outputs,
        } = this.vertexPhase2(inputValues, bindingValues, dataMap, builtinValues);
        return this.vertexPhase3(preamble, body, usedBuiltins, outputs, entryPoint);
    }

    protected vertexPhase1(d: VertexShaderDescriptor) {
        const parts: string[] = [];
        const inputValues: ValueMap = new Map();

        const dataMap = new Map<string, ComponentData>();


        const inputLines = d.inputs.map((f) => {
            inputValues.set(f.name, {type: f.type, access: `input.${f.id}`});
            return `  @location(${f.location}) ${f.id}: ${f.type},`;
        });
        parts.push(`struct VertexInput {\n${inputLines.join("\n")}\n};`);

        const {bindingCode, values} = buildBindingDecls(d.bindings);
        const bindingValues = toValueMap(values);
        parts.push(bindingCode);


        const builtinValues: ValueMap = new Map(
            VERTEX_INPUT_BUILTINS.map((b) => [b.name, {type: b.type, access: b.name}]),
        );

        d.componentDataMap.forEach((component, i) => {
            const value: ComponentData = {}

            if (component.uv) {
                value.uv = inputValues.get(component.uv);
            }

            dataMap.set(i, value)
        })

        return {preamble: parts.join("\n\n"), dataMap, inputValues, bindingValues, builtinValues};
    }

    protected abstract vertexPhase2(
        inputValues: ValueMap,
        bindingValues: ValueMap,
        dataMap: Map<string, ComponentData>,
        builtinValues: ValueMap,
    ): VertexPhase2Output;

    protected vertexPhase3(preamble: string, body: string, usedBuiltins: UsedBuiltin[], outputs: OutputFieldDecl[], entryPoint: string): string {
        const outputStruct = renderStruct("VertexOutput", outputs);
        const params = usedBuiltins.map((b) => `, @builtin(${b.name}) ${b.name}: ${b.type}`).join("");

        return `${preamble}

${outputStruct}

@vertex
fn ${entryPoint}(input: VertexInput${params}) -> VertexOutput {
${body}
}`;
    }
}

export type FragmentPhase2Output = {
    body: string;
    usedBuiltins: UsedBuiltin[],
    expectedFromVertex: OutputFieldDecl[],
    outputs: OutputFieldDecl[]
};

export abstract class FragmentAssemblerBase {
    assemble(d: FragmentShaderDescriptor, entryPoint: string): string {
        const {preamble, varyingValues, bindingValues, componentsMap, builtinValues} = this.fragmentPhase1(d);

        const {
            body,
            usedBuiltins,
            outputs,
            expectedFromVertex
        } = this.fragmentPhase2(varyingValues, bindingValues, componentsMap, builtinValues);
        return this.fragmentPhase3(preamble, body, usedBuiltins, expectedFromVertex, outputs, entryPoint);
    }

    protected fragmentPhase1(d: FragmentShaderDescriptor) {
        const parts: string[] = [];
        const varyingValues: ValueMap = new Map();

        const {bindingCode, values} = buildBindingDecls(d.bindings);
        const bindingValues = toValueMap(values);
        parts.push(bindingCode);

        const componentsMap = buildComponentsMap(d.componentDataMap, bindingValues, varyingValues);

        const builtinValues: ValueMap = new Map(
            FRAGMENT_INPUT_BUILTINS.map((b) => [b.name, {type: b.type, access: b.name}]),
        );

        return {preamble: parts.join("\n\n"), varyingValues, bindingValues, componentsMap, builtinValues};
    }

    protected abstract fragmentPhase2(
        varyingValues: ValueMap,
        bindingValues: ValueMap,
        componentsMap: ComponentsMap,
        builtinValues: ValueMap,
    ): FragmentPhase2Output;

    protected fragmentPhase3(preamble: string, body: string, usedBuiltins: UsedBuiltin[], expectedFromVertex: OutputFieldDecl[], outputs: OutputFieldDecl[], entryPoint: string): string {
        const outputStruct = renderStruct("FragmentOutput", outputs);
        const hasInput = expectedFromVertex.length > 0;
        const hasBuiltIn = expectedFromVertex.length > 0;
        const inputStruct = hasInput ? renderStruct("FragmentInput", expectedFromVertex) : ''
        const params = usedBuiltins.map((b) => `@builtin(${b.name}) ${b.name}: ${b.type}`).join(",");

        const functionDefinition = `@fragment fn ${entryPoint}(${hasInput ? "input:FragmentInput" : ""}${hasInput && hasBuiltIn ? "," : ""}${params}) -> FragmentOutput`

        return `
        ${preamble}
        ${outputStruct}
        ${inputStruct}
        ${functionDefinition} {
        ${body}
        }`;
    }
}