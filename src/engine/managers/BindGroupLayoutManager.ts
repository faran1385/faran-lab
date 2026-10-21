import {BindGroupLayoutTracker} from "../Trackers/Trackers.ts";
import {ResourceManager} from "./Manager.ts";

/**
 * Layouts are content-hashed like everything else: the scene, material and node layouts all come from layout
 * representations, so there are no special static keys any more.
 */
export class BindGroupLayoutManager extends ResourceManager<GPUBindGroupLayoutDescriptor, BindGroupLayoutTracker> {
    private device: GPUDevice;

    constructor(device: GPUDevice) {
        super();
        this.device = device;
    }

    protected build(getDescriptor: () => GPUBindGroupLayoutDescriptor): BindGroupLayoutTracker {
        return new BindGroupLayoutTracker(this.device.createBindGroupLayout(getDescriptor()));
    }
}
