import type {SkinInstanceWrapper} from "../wrappers/SkinInstanceWrapper.ts";
import type {BufferManager} from "../managers/BufferManager.ts";

/** What the renderer hands a skinning module once per frame. */
export interface SkinUpdateFrame {
    /**
     * The skins of the skinned mesh nodes the render traversal visited this frame, deduplicated (nodes that share a
     * skin contribute it once). Their palette buffers exist: they are keyed by `skin.uuid` and were ensured during the
     * traversal, before this call.
     */
    skins: ReadonlySet<SkinInstanceWrapper>;
    /**
     * True when at least one world matrix was rebuilt since the previous frame (always true on the first frame).
     * When false, no joint moved, so a skin that has already been written needs nothing.
     * A skin the updater has never written must still be written regardless: it may have just entered the scene.
     * Per skin, `skin.getJointsWorldVersion()` tells you whether its own joints moved (compare for equality with the
     * value from your last write; start from -1).
     */
    worldMoved: boolean;
    /** Writes into a buffer by its key. For a palette: `upload(skin.uuid, data)`. */
    upload: BufferManager["upload"];
}

/**
 * The seam where a skinning module (LBS, DQS, ...) plugs into the frame. Called by Renderer.render after the world
 * matrices were rebuilt and before the command buffer is submitted, so jointWorld is current this frame and the
 * palette write is visible to this frame's draws.
 */
export interface SkinUpdater {
    update(frame: SkinUpdateFrame): void;
}
