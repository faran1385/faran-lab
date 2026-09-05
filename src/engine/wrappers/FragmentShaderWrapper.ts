import {ShaderModuleWrapper} from "./ShaderModuleWrapper.ts";
import type {WGSLType} from "../descriptorProducer/utils.ts";
import type {BindGroupEntry} from "../descriptorProducer/ShaderDescriptorProducer.ts";

export interface ShaderTargetField {
    location: number;         // @location(n) on the fragment output struct
    wgslType: WGSLType;          // e.g. "vec4<f32>" — for the struct field itself
    format: GPUTextureFormat;  // e.g. "bgra8unorm", "rgba16float" — for PipelineCreatorLayer's target config
}

export class FragmentShaderWrapper extends ShaderModuleWrapper {
    private outputs: ShaderTargetField[] = [];
    private code: string = "";
    private bindings: BindGroupEntry[] = [];

    setBindings(bindings: BindGroupEntry[]): void { this.bindings = bindings; this.bumpVersion(); }
    getBindings(): BindGroupEntry[] { return this.bindings; }

    setOutputs(outputs: ShaderTargetField[]): void {
        this.outputs = outputs;
        this.bumpVersion();
    }
    getOutputs(): ShaderTargetField[] { return this.outputs; }

    setCode(code: string): void {
        this.code = code;
        this.bumpVersion();
    }
    getCode(): string { return this.code; }

    protected buildHashKey(): string {
        return this.code;
    }
}