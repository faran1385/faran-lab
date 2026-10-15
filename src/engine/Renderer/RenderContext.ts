import type {CentralManager} from "../managers/CentralManager.ts";
import type {CentralProducer} from "../producers/CentralProducer.ts";
import type {HashResolver} from "../hashing/utils/HashResolver.ts";
import type {RenderCache} from "./RenderCache.ts";
import type {SkinInstanceWrapper} from "../wrappers/SkinInstanceWrapper.ts";

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
    rendererUUID: string,
    /** Skins of the skinned mesh nodes visited this frame. Filled by RenderItemBuilder, consumed by each skin's SkinningMethod. */
    frameSkins: Set<SkinInstanceWrapper>,
    /**
     * World epoch after this frame's world-matrix pass (see worldEpoch.ts). A skinning method remembers the value it
     * last wrote at: equal means no joint anywhere moved since. Only meaningful once the world pass has run, i.e.
     * while skinning methods update.
     */
    worldEpoch: number,
}
