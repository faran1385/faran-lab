import {ResourceManager} from "./Manager.ts";
import {PipelineTracker} from "../Trackers/Trackers.ts";

export class PipelineManager extends ResourceManager<GPURenderPipelineDescriptor, PipelineTracker> {
    private device: GPUDevice;
    constructor(device: GPUDevice) { super(); this.device = device; }

    protected build(getDescriptor: () => GPURenderPipelineDescriptor): PipelineTracker {
        return new PipelineTracker(this.device.createRenderPipeline(getDescriptor()));
    }
}

