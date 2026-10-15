import {BindGroupLayoutTracker} from "../Trackers/Trackers.ts";
import {ResourceManager} from "./Manager.ts";

export const GLOBAL_LAYOUT_KEY = "GLOBALLAYOUT";


export class BindGroupLayoutManager extends ResourceManager<GPUBindGroupLayoutDescriptor, BindGroupLayoutTracker> {
    private device: GPUDevice;

    constructor(device: GPUDevice) {
        super();
        this.device = device;

        // group 0: scene
        this.cache.set(GLOBAL_LAYOUT_KEY, new BindGroupLayoutTracker(
            device.createBindGroupLayout({
                label: GLOBAL_LAYOUT_KEY,
                entries: [
                    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
                ],
            })
        ));
        // group 2 (node) layouts are not seeded: they are generated at runtime, see NodeBindGroupLayoutProducer
    }
    protected build(getDescriptor: () => GPUBindGroupLayoutDescriptor): BindGroupLayoutTracker {
        return new BindGroupLayoutTracker(this.device.createBindGroupLayout(getDescriptor()));
    }
}

