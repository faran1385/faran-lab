import type {ShaderModuleWrapper} from "../wrappers/ShaderModuleWrapper.ts";

export class ShaderModuleProducer {
    static produce(wrapper: ShaderModuleWrapper): GPUShaderModuleDescriptor {
        const code = wrapper.getCode();
        if (code === "") {
            throw new Error(`ShaderModuleProducer: wrapper ${wrapper.uuid} has no code, was the assembler run before ensure()?`);
        }
        return { label: wrapper.uuid, code };
    }
}