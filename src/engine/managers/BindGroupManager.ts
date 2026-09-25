import {ResourceManager} from "./Manager.ts";
import {BindGroupTracker} from "../Trackers/Trackers.ts";

export class BindGroupManager extends ResourceManager<GPUBindGroupDescriptor, BindGroupTracker> {
    private device: GPUDevice;
    constructor(device: GPUDevice) { super(); this.device = device; }

    protected build(getDescriptor: () => GPUBindGroupDescriptor): BindGroupTracker {
        return new BindGroupTracker(this.device.createBindGroup(getDescriptor()));
    }
}