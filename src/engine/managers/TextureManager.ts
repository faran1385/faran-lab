import {ResourceManager} from "./Manager.ts";
import {TextureTracker} from "../Trackers/Trackers.ts";
import type {TextureDescriptor} from "../producers/TextureDescriptorProducer.ts";

export class TextureManager extends ResourceManager<TextureDescriptor, TextureTracker> {
    private device: GPUDevice;
    constructor(device: GPUDevice) { super(); this.device = device; }

    protected build(getDescriptor: () => TextureDescriptor): TextureTracker {
        const { texture: desc, data, bytesPerRow, width, height } = getDescriptor();
        const texture = this.device.createTexture(desc);
        this.device.queue.writeTexture({ texture }, data, { bytesPerRow }, { width, height });
        return new TextureTracker(texture);
    }
}
