import {ResourceManager} from "./Manager.ts";
import {ShaderModuleTracker} from "../Trackers/Trackers.ts";

export class ShaderModuleManager extends ResourceManager<GPUShaderModuleDescriptor, ShaderModuleTracker> {
    private device: GPUDevice;
    constructor(device: GPUDevice) { super(); this.device = device; }

    protected build(getDescriptor: () => GPUShaderModuleDescriptor): ShaderModuleTracker {
        const descriptor = getDescriptor();
        const module = this.device.createShaderModule(descriptor);
        module.getCompilationInfo().then((info) => {
            const errors = info.messages.filter((m) => m.type === "error");
            if (errors.length === 0) return;
            const details = errors.map((m) => `  line ${m.lineNum}:${m.linePos} ${m.message}`).join("\n");
            console.error(`WGSL compile errors in shader ${descriptor.label}:\n${details}`);
        });

        return new ShaderModuleTracker(module);
    }
}