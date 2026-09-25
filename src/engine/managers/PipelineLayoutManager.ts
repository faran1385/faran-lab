import {ResourceManager} from "./Manager.ts";
import {PipelineLayoutTracker} from "../Trackers/Trackers.ts";


export class PipelineLayoutManager extends ResourceManager<GPUPipelineLayoutDescriptor, PipelineLayoutTracker> {
    private device: GPUDevice;

    constructor(device: GPUDevice) {
        super();
        this.device = device;
    }

    protected build(getDescriptor: () => GPUPipelineLayoutDescriptor): PipelineLayoutTracker {
        return new PipelineLayoutTracker(this.device.createPipelineLayout(getDescriptor()));
    }
}