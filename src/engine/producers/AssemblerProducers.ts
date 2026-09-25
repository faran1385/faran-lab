import {
    type MaterialFactorsPlan,
    type GeometryAttributePlan,
    getWGSLTypeFromVertexFormat,
    type WGSLType
} from "./utils.ts";
import {FACTORS_BINDING, type MaterialBindingPlan} from "./BindGroupLayoutProducer.ts";

export interface VertexInputField {
    name: string;
    id: string;
    type: WGSLType;
    location: number
}

export type BindGroupEntry =
    | BindGroupUniformEntry
    | BindGroupStorageEntry
    | BindGroupTextureEntry
    | BindGroupSamplerEntry;

export interface StructField {
    name: string;
    type: WGSLType;
    offset: number;
}

export interface BindGroupUniformEntry {
    kind: "uniform";
    group: number;
    binding: number;
    name: string;        // WGSL variable name
    structName: string;  // WGSL struct type name
    fields: StructField[];
    size: number;         // total struct byte size
}

export interface BindGroupStorageEntry {
    kind: "storage";
    group: number;
    binding: number;
    name: string;
    elementStructName: string;
    elementFields: StructField[];
    access: "read" | "read_write";
}

export interface BindGroupTextureEntry {
    kind: "texture";
    group: number;
    binding: number;
    name: string;
    textureType: string;
    componentName?: string;
    uvAttribute?: string;
}

export interface BindGroupSamplerEntry {
    kind: "sampler";
    group: number;
    binding: number;
    name: string;
    samplerType: string;
    componentName?: string
}


export interface VertexShaderDescriptor {
    inputs: VertexInputField[];
    bindings: BindGroupEntry[],
    componentDataMap: Map<string, {
        uv?: string
    }>
}

export interface FragmentShaderDescriptor {
    bindings: BindGroupEntry[];
}


function toWgslIdentifier(name: string): string {
    const id = name.replace(/[^A-Za-z0-9_]/g, "_");
    return /^[A-Za-z]/.test(id) ? id : `a_${id}`;
}

export function sceneBindings(): BindGroupEntry[] {
    return [
        {
            kind: "uniform",
            group: 0,
            binding: 0,
            name: "camera",
            structName: "CameraUniforms",
            fields: [
                {name: "view", type: "mat4x4f", offset: 0},
                {name: "projection", type: "mat4x4f", offset: 64},
            ],
            size: 128,
        },
    ];
}

// --- Group 2 (per-primitive/node) — fixed shape for now -------------------

export function nodeBindings(): BindGroupEntry[] {
    return [
        {
            kind: "uniform",
            group: 2,
            binding: 0,
            name: "node",
            structName: "NodeUniforms",
            fields: [
                {name: "worldMatrix", type: "mat4x4f", offset: 0},
            ],
            size: 64,
        },
    ];
}

export class VertexShaderProducer {
    static produce(getMaterialPlan: () => MaterialBindingPlan, getAttributePlan: () => GeometryAttributePlan): VertexShaderDescriptor {
        const plan = getAttributePlan();
        const matPlan = getMaterialPlan();
        const componentDataMap: VertexShaderDescriptor["componentDataMap"] = new Map()
        matPlan.byComponent.forEach((i, name) => {
            if (i.texture) {
                componentDataMap.set(name, {
                    uv: i.texCoord
                })
            }
        })

        const inputs: VertexInputField[] = plan.slots.map((s) => ({
            name: s.name,
            id: toWgslIdentifier(s.name),
            type: getWGSLTypeFromVertexFormat(s.format),
            location: s.shaderLocation,
        }));


        return {inputs, componentDataMap, bindings: [...sceneBindings(), ...nodeBindings()]};
    }
}

function materialBindings(bindingPlan: MaterialBindingPlan, factorPlan: MaterialFactorsPlan): BindGroupEntry[] {
    const FactorFields: StructField[] = [];
    let FactorSize = 0;
    factorPlan.forEach((item, name) => {
        FactorFields.push({offset: item.offset, type: item.wgslType, name});
        FactorSize += typeof item.factor === "number" ? 1 : item.factor.length;
    });

    const entries: BindGroupEntry[] = [{
        kind: "uniform", group: 1, binding: FACTORS_BINDING,
        name: "material", structName: "MaterialUniforms",
        fields: FactorFields, size: FactorSize,
    }];

    const owner = new Map<number, { componentName: string; texCoord: string }>();
    for (const [componentName, {texture, sampler, texCoord}] of bindingPlan.byComponent) {
        owner.set(texture, {componentName, texCoord});
        owner.set(sampler, {componentName, texCoord});
    }

    for (const slot of bindingPlan.slots) {
        const info = owner.get(slot.binding);
        entries.push(
            slot.kind === "texture"
                ? {
                    kind: "texture",
                    group: 1,
                    binding: slot.binding,
                    name: `texture${slot.binding}`,
                    textureType: "texture_2d<f32>",
                    componentName: info?.componentName,
                    uvAttribute: info ? info.texCoord : undefined,
                }
                : {
                    kind: "sampler",
                    group: 1,
                    binding: slot.binding,
                    name: `sampler${slot.binding}`,
                    samplerType: "sampler",
                    componentName: info?.componentName,
                }
        );
    }
    return entries;
}

export class FragmentShaderProducer {
    static produce(
        getBindingPlan: () => MaterialBindingPlan,
        getFactorsPlan: () => MaterialFactorsPlan,
    ): FragmentShaderDescriptor {
        return {
            bindings: [...sceneBindings(), ...materialBindings(getBindingPlan(), getFactorsPlan())],
        };
    }
}