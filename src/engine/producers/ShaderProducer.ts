export class ShaderModuleProducer {
    static produce(code: string, label: string): GPUShaderModuleDescriptor {
        if (code === "") {
            throw new Error(`ShaderModuleProducer: "${label}" has no code, were the stages filled before the frame?`);
        }
        return {label, code};
    }
}
