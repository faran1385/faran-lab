import type {CentralManager} from "../managers/CentralManager.ts";
import type {CentralProducer} from "../producers/CentralProducer.ts";
import type {HashResolver} from "../hashing/utils/HashResolver.ts";
import type {RenderCache} from "./RenderCache.ts";

export interface FrameInfo {
    colorFormat: GPUTextureFormat;
    depthFormat: GPUTextureFormat;
}

/** Everything a render layer may use. Owned by one Renderer. */
export interface RenderContext {
    managers: CentralManager;
    producer: CentralProducer;
    hashes: HashResolver;
    frame: FrameInfo;
    cache: RenderCache,
    rendererUUID: string
}
