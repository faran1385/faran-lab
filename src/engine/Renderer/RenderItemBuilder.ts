import type {NodeInternal} from "../internals/NodeInternal.ts";
import type {PrimitiveInternal} from "../internals/PrimitiveInternal.ts";
import {getEpoch} from "../hashing/utils/epoch.ts";
import type {RenderItem} from "./RenderItem.ts";
import type {RenderContext} from "./RenderContext.ts";
import {ResourceLayer} from "./ResourceLayer.ts";
import {RenderItemAssembler} from "./RenderItemAssembler.ts";
import {acquireHeld, emptyHeldKeys, type HeldKeys, releaseHeld} from "./HeldKeys.ts";

export type {RenderItem, DrawCall, VertexBufferBinding, BindGroupBinding} from "./RenderItem.ts";
export type {RenderContext, FrameInfo} from "./RenderContext.ts";

/**
 * Orchestrates the render layers for one node. It works on internals only: the node adapter already turned the
 * wrappers into pipeline representations before the frame, so there is nothing left to translate or generate here.
 *
 *   ResourceLayer       representations -> GPU resources   (keys are the representations' content hashes)
 *   RenderItemAssembler keys -> RenderItem                 (pure lookup)
 */
export class RenderItemBuilder {
    static build(node: NodeInternal, ctx: RenderContext): RenderItem[] {
        const {cache, managers} = ctx;

        // every frame, quiet or not: the presence sets must see every node that is still in the scene
        cache.touch(node);

        const entry = cache.get(node);
        // The render side's own inputs. They stamp the node, so this comes before the staleness checks and a first
        // build sees them.
        // Quiet frame: nothing anywhere changed since the last frame
        if (entry && cache.lastFrameEpoch === getEpoch()) return entry.items;

        // One comparison tells whether anything this node draws with changed (mesh, primitives, materials, geometry,
        // shader code, pipelines): the node's stamp covers all of it.
        if (entry && node.hashProvider.getChangedAt() <= entry.builtAt) return entry.items;

        const held = emptyHeldKeys();
        const items: RenderItem[] = [];
        for (const primitive of node.getMesh()?.getAllPrimitives() ?? []) {
            const item = RenderItemBuilder.buildPrimitive(node, primitive, ctx, held);
            if (item) items.push(item);
        }
        // acquire the new first, then release the old: keys the two share net out and never touch zero
        acquireHeld(managers, held);
        if (entry) releaseHeld(managers, entry.held);

        // after building: building itself may stamp the node
        cache.set(node, {items, held, builtAt: getEpoch()});
        return items;
    }

    private static buildPrimitive(node: NodeInternal, primitive: PrimitiveInternal, ctx: RenderContext, held: HeldKeys): RenderItem | null {
        const pipelines = node.getPipelines().get(primitive.uuid);
        const geometry = primitive.getGeo();
        if (!pipelines || pipelines.length === 0 || !geometry || !geometry.getDrawInfo()) return null;

        // All variants of one primitive share their bind groups: take them from the first.
        const bindgroupKeys = Array.from(pipelines[0].bindgroups.entries())
            .sort(([a], [b]) => a - b)
            .map(([slot, bindgroup]) => ({slot, key: ResourceLayer.bindgroup(bindgroup, ctx, held)}));
        ResourceLayer.geometry(geometry, ctx, held);

        const pipelineKeys: string[] = [];
        for (const pipeline of pipelines) {
            pipeline.setVertex(primitive.vertex);
            pipeline.setFragment(primitive.fragment);

            const key = ResourceLayer.pipeline(pipeline, ctx, held);
            if (key === null) return null;       // not complete yet: not drawn until it is
            pipelineKeys.push(key);
        }

        return RenderItemAssembler.assemble(pipelineKeys, bindgroupKeys, geometry, ctx);
    }
}
