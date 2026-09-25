import {BindGroupLayoutTracker} from "../Trackers/Trackers.ts";
import {ResourceManager} from "./Manager.ts";

export const GLOBAL_LAYOUT_KEY = "GLOBALLAYOUT";
export const NODE_LAYOUT_KEY = "NODELAYOUT";


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

        // group 2: node
        this.cache.set(NODE_LAYOUT_KEY, new BindGroupLayoutTracker(
            device.createBindGroupLayout({
                label: NODE_LAYOUT_KEY,
                entries: [
                    // worldMatrix
                    { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
                ],
            })
        ));
    }
    protected build(getDescriptor: () => GPUBindGroupLayoutDescriptor): BindGroupLayoutTracker {
        return new BindGroupLayoutTracker(this.device.createBindGroupLayout(getDescriptor()));
    }
}

