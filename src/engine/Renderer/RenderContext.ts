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
    /** Skins of the skinned mesh nodes visited this frame. Filled by RenderItemBuilder, consumed by the SkinUpdater. */
    frameSkins: Set<SkinInstanceWrapper>;
    /** Set after world matrices are current, before skinning methods update their palettes. */
    worldMoved: boolean;
}
