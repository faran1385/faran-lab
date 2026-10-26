import type {NodeInternal} from "../internals/NodeInternal.ts";
import type {RenderItem} from "./RenderItem.ts";
import type {RenderContext} from "./RenderContext.ts";
import {type HeldKeys, releaseHeld} from "./HeldKeys.ts";

/**
 * Render items last built for one node.
 *
 * Items are cached per node (not per primitive) because a render item holds the node's bind group, and a mesh may
 * be shared by several nodes.
 */
export interface NodeRenderEntry {
    items: RenderItem[];
    /** The resources the items hold; released when the entry is replaced or the node leaves the scene. */
    held: HeldKeys;
    /** Epoch at which the items were (re)built. They are stale once the node's change stamp is newer. */
    builtAt: number;
}

/**
 * Owned by one Renderer: the cached items reference that renderer's GPU resources.
 * Note for future resource eviction: cached items keep raw GPU objects alive, evicting a resource must also
 * invalidate the items that use it.
 */
export class RenderCache {
    private readonly entries = new WeakMap<NodeInternal, NodeRenderEntry>();
    private currentNodeHolder = new Set<NodeInternal>();
    private previousNodeHolder = new Set<NodeInternal>();

    /**
     * The global epoch at the end of the previous frame. If it still equals getEpoch(), nothing that can affect
     * a render item has changed anywhere, and every cached item can be reused without looking at any node.
     */
    /** Camera identity and matrix versions last written into this renderer's global GPU buffer. */
    lastCameraUUID: string | null = null;
    lastCameraViewVersion = -1;
    lastCameraProjectionVersion = -1;

    lastFrameEpoch = -1;

    /** Forces the next frame to check every node, whatever the epoch says (the frame formats changed, say). */
    invalidateAll() {
        this.lastFrameEpoch = -1;
    }

    delete(node: NodeInternal) { this.entries.delete(node); }

    endFrame(ctx: RenderContext) {
        for (const node of this.previousNodeHolder) {          // used last frame, not touched this frame
            const entry = this.entries.get(node);
            if (entry) releaseHeld(ctx.managers, entry.held);
            this.entries.delete(node);                         // so a re-added node rebuilds from scratch
        }
        this.previousNodeHolder.clear();
        [this.currentNodeHolder, this.previousNodeHolder] = [this.previousNodeHolder, this.currentNodeHolder];
    }

    touch(node: NodeInternal) {
        this.currentNodeHolder.add(node);
        this.previousNodeHolder.delete(node);
    }

    get(node: NodeInternal): NodeRenderEntry | undefined {
        return this.entries.get(node);
    }

    set(node: NodeInternal, entry: NodeRenderEntry): void {
        this.entries.set(node, entry);
    }
}
