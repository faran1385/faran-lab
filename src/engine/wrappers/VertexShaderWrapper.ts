import {ShaderModuleWrapper} from "./ShaderModuleWrapper.ts";
import {type WGSLType} from "../descriptorProducer/utils.ts";
import type {BindGroupEntry} from "../descriptorProducer/ShaderDescriptorProducer.ts";

export interface VertexInputField {
    name: string;      // e.g. "position", "normal"
    type: WGSLType;       // WGSL type, e.g. "vec3<f32>"
    location: number;    // @location(n) — always present, geometry attributes have no builtins
}

export type VertexOutputField =
    | { kind: "builtin"; name: string; type: WGSLType; builtin: string }  // e.g. @builtin(position)
    | { kind: "varying"; name: string; type: WGSLType; location: number }; // e.g. @location(0) world_position

export class VertexShaderWrapper extends ShaderModuleWrapper {
    private inputs: VertexInputField[] = [];
    private outputs: VertexOutputField[] = [];
    private bindings: BindGroupEntry[] = [];

    setInputs(inputs: VertexInputField[]): void { this.inputs = inputs; this.bumpVersion(); }
    getInputs(): VertexInputField[] { return this.inputs; }

    setOutputs(outputs: VertexOutputField[]): void { this.outputs = outputs; this.bumpVersion(); }
    getOutputs(): VertexOutputField[] { return this.outputs; }

    setBindings(bindings: BindGroupEntry[]): void { this.bindings = bindings; this.bumpVersion(); }
    getBindings(): BindGroupEntry[] { return this.bindings; }

}