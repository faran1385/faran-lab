// --- shader-binding-codegen.ts (shared, not owned by either base) ---------

import type {WGSLType} from "../producers/utils.ts";
import type {BindGroupEntry} from "../producers/AssemblerProducers.ts";

export interface AccessibleValue {
    type: WGSLType;
    access: string;
}

export function buildBindingDecls(entries: BindGroupEntry[]): {
    bindingCode: string;
    values: Record<string, AccessibleValue>
} {
    const structDefs: string[] = [];
    const varDecls: string[] = [];
    const values: Record<string, AccessibleValue> = {};

    const setValue = (key: string, v: AccessibleValue) => {
        if (key in values) throw new Error(`buildBindingDecls: duplicate value name "${key}"`);
        values[key] = v;
    };

    for (const entry of entries) {
        switch (entry.kind) {
            case "uniform": {
                const fieldLines = entry.fields.map((f) => `  ${f.name}: ${f.type},`);
                structDefs.push(`struct ${entry.structName} {\n${fieldLines.join("\n")}\n};`);
                varDecls.push(`@group(${entry.group}) @binding(${entry.binding}) var<uniform> ${entry.name}: ${entry.structName};`);
                for (const f of entry.fields) {

                    setValue(f.name, {type: f.type, access: `${entry.name}.${f.name}`})
                }
                break;
            }
            case "storage": {
                const fieldLines = entry.elementFields.map((f) => `  ${f.name}: ${f.type},`);
                structDefs.push(`struct ${entry.elementStructName} {\n${fieldLines.join("\n")}\n};`);
                varDecls.push(`@group(${entry.group}) @binding(${entry.binding}) var<storage, ${entry.access}> ${entry.name}: array<${entry.elementStructName}>;`);
                setValue(entry.name, {type: `array<${entry.elementStructName}>` as WGSLType, access: entry.name})

                break;
            }
            case "texture":
                varDecls.push(`@group(${entry.group}) @binding(${entry.binding}) var ${entry.name}: ${entry.textureType};`);
                setValue(entry.name, {type: entry.textureType as WGSLType, access: entry.name})

                break;
            case "sampler":
                varDecls.push(`@group(${entry.group}) @binding(${entry.binding}) var ${entry.name}: ${entry.samplerType};`);
                setValue(entry.name, {type: entry.samplerType as WGSLType, access: entry.name})
                break;
        }
    }

    return {bindingCode: [...structDefs, ...varDecls].join("\n"), values};
}