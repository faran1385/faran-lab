import {ResourceManager} from "./Manager.ts";
import {SamplerTracker} from "../Trackers/Trackers.ts";

export class SamplerManager extends ResourceManager<GPUSamplerDescriptor, SamplerTracker> {
    private device: GPUDevice;
    constructor(device: GPUDevice) { super(); this.device = device; }

    protected build(getDescriptor: () => GPUSamplerDescriptor): SamplerTracker {
        return new SamplerTracker(this.device.createSampler(getDescriptor()));
    }
}