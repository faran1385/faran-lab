import {ResourceManager} from "./Manager.ts";
import {TextureTracker} from "../Trackers/Trackers.ts";
import type {TextureDescriptor, TextureUpdateDescriptor} from "../producers/TextureDescriptorProducer.ts";

export class TextureManager extends ResourceManager<TextureDescriptor, TextureTracker> {
    private device: GPUDevice;

    constructor(device: GPUDevice) {
        super();
        this.device = device;
    }

    upload(hash: string, descriptor: TextureUpdateDescriptor) {
        const texture = this.cache.get(hash)?.raw
        if (!texture) throw new Error(`texture with ${hash} not found`);
        const {data, bytesPerRow, width, height} = descriptor;
        this.device.queue.writeTexture({texture}, data, {bytesPerRow}, {width, height});
        return new TextureTracker(texture);
    }

    protected build(getDescriptor: () => TextureDescriptor): TextureTracker {
        const desc = getDescriptor();
        const texture = this.device.createTexture(desc);
        return new TextureTracker(texture);
    }
}
