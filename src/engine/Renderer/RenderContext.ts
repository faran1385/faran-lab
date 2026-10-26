import type {CentralManager} from "../managers/CentralManager.ts";
import type {CentralProducer} from "../producers/CentralProducer.ts";
import type {Hasher} from "../hashing/utils/Hasher.ts";
import type {RenderCache} from "./RenderCache.ts";

export interface FrameInfo {
    colorFormat: GPUTextureFormat;
    depthFormat: GPUTextureFormat;
}

/** Everything a render layer may use. Owned by one Renderer. There is no wrapper in here, and no wrapper is reachable from it. */
export interface RenderContext {
    managers: CentralManager;
    producer: CentralProducer;
    hasher: Hasher;
    frame: FrameInfo;
    cache: RenderCache;
}
