import type {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import type {RenderItem} from "./RenderItemBuilder.ts";

/**
 * Render items last built for one node.
 *
 * Items are cached per node (not per primitive) because a render item holds the node's bind group, and a mesh may
 * be shared by several nodes. Items also hold the camera's bind group, hence cameraUuid.
 */
export interface NodeRenderEntry {
    items: RenderItem[];
    primitives: PrimitiveWrapper[];
    /** Epoch at which items[i] was (re)built. items[i] is stale once primitives[i].getChangedAt() is newer. */
    builtAt: number[];
    /** Epoch at which the list of primitives itself was last read (mesh swap / primitive added). */
    structureBuiltAt: number;
    cameraUuid: string;
}

/**
 * Owned by one Renderer: the cached items reference that renderer's GPU resources.
 * Note for future resource eviction: cached items keep raw GPU objects alive, evicting a resource must also
 * invalidate the items that use it.
 */
export class RenderCache {
    private readonly entries = new WeakMap<NodeWrapper, NodeRenderEntry>();

    /**
     * The global epoch at the end of the previous frame. If it still equals getEpoch(), nothing that can affect
     * a render item has changed anywhere, and every cached item can be reused without looking at any wrapper.
     */
    lastFrameEpoch = -1;

    get(node: NodeWrapper): NodeRenderEntry | undefined {
        return this.entries.get(node);
    }

    set(node: NodeWrapper, entry: NodeRenderEntry): void {
        this.entries.set(node, entry);
    }
}
