import type {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import type {HashData} from "../hashing/utils/HashData.ts";
import {getEpoch} from "../hashing/utils/epoch.ts";
import type {RenderItem} from "./RenderItem.ts";
import type {RenderContext} from "./RenderContext.ts";
import {UpdateLayer} from "./UpdateLayer.ts";
import {ShaderCodeLayer} from "./ShaderCodeLayer.ts";
import {ResourceLayer} from "./ResourceLayer.ts";
import {RenderItemAssembler} from "./RenderItemAssembler.ts";
import type {NodeRenderEntry} from "./RenderCache.ts";

export type {RenderItem, DrawInfo, VertexBufferBinding, BindGroupBinding} from "./RenderItem.ts";
export type {RenderContext, FrameInfo} from "./RenderContext.ts";

/**
 * Orchestrates the render layers for one node. It owns no logic of its own besides deciding which primitives need
 * rebuilding; each step is a layer with a single responsibility:
 *
 *   HashResolver       wrappers -> hashes            (hash layer, cached by change stamp)
 *   UpdateLayer        hashes/flags -> what to redo  (shader inputs, factor uploads)
 *   ShaderCodeLayer    run the assemblers
 *   ResourceLayer      ensure GPU resources          (only for hashes that were computed)
 *   RenderItemAssembler hashes -> RenderItem         (pure lookup)
 */
export class RenderItemBuilder {
    static build(node: NodeWrapper, ctx: RenderContext): RenderItem[] {
        const {cache, hashes, managers} = ctx;

            // every frame, quiet or not: the presence sets must see every node that is still in the scene
        cache.touch(node);

        const entry = cache.get(node);

        // Quiet frame: nothing anywhere changed since the last frame
        if (entry && cache.lastFrameEpoch === getEpoch()) return entry.items;

        // Structure path: first time we see the node, or its mesh / primitive list changed
        if (!entry || node.hashProvider.getStructureChangedAt() > entry.structureBuiltAt) {
            const primitives = node.getMesh()?.getAllPrimitives() ?? [];

            ResourceLayer.node(node, ctx);
            const items: RenderItem[] = new Array(primitives.length);
            for (let i = 0; i < primitives.length; i++) {
                items[i] = RenderItemBuilder.buildPrimitive(node, primitives[i], ctx);
            }

            // after building: building itself may stamp wrappers (shader dirty marks)
            const builtAt = getEpoch();
            const newEntry: NodeRenderEntry = {
                items,
                primitives,
                builtAt: primitives.map(() => builtAt),
                structureBuiltAt: builtAt,
            };

            hashes.acquireEntry(node, newEntry, ctx);              // acquire the new first...
            if (entry) hashes.releaseEntry(node, entry, ctx);      // ...then release the old, shared keys net out
            cache.set(node, newEntry);
            return items;
        }

        // Incremental path: rebuild only primitives whose own stamp is newer than when their item was built.
        // In place, no new entry: unchanged items keep their counts untouched.
        for (let i = 0; i < entry.primitives.length; i++) {
            if (entry.primitives[i].getChangedAt() <= entry.builtAt[i]) continue;

            const next = RenderItemBuilder.buildPrimitive(node, entry.primitives[i], ctx);
            hashes.swapData(managers, next.hashData, entry.items[i].hashData);   // acquire new, release old, per key
            entry.items[i] = next;
            entry.builtAt[i] = getEpoch();                                       // after building
        }
        return entry.items;
    }
    // ---- primitive-level ----

    private static buildPrimitive(node: NodeWrapper, p: PrimitiveWrapper, ctx: RenderContext): RenderItem {
        const material = p.getMaterial();
        const geometry = p.getGeometry();
        const {hashes, producer} = ctx;

        const materialHashes = hashes.resolveMaterial(material, (m) => producer.getBindingPlan(m));
        const geometryHashes = hashes.resolveGeometry(geometry);

        UpdateLayer.syncShaderInputs(p, materialHashes.hashes, geometryHashes.hashes);
        ShaderCodeLayer.generate(p, ctx);                       // return value no longer needed

        const pipelineHashes = hashes.resolvePipeline(p.getPipeline(), materialHashes.hashes, geometryHashes.hashes);
        const data: HashData = {
            material: materialHashes.hashes,
            geometry: geometryHashes.hashes,
            pipeline: pipelineHashes.hashes,
        };

        // Resources: always ensure. computed:false only means "the hashes didn't change",
        // not "the resources still exist". They may have been destroyed after a release.
        // Order matters: pipeline needs the shader modules and layouts before it.
        ResourceLayer.geometry(geometry, data.geometry, ctx);
        ResourceLayer.material(material, data.material, ctx);
        ResourceLayer.shaders(p, data.pipeline, ctx);
        ResourceLayer.pipeline(p, data, ctx);

        // Data uploads: only when the hashes were recomputed (a freshly created resource already has current data)
        if (geometryHashes.computed) UpdateLayer.updateAttributeBuffers(geometry, geometryHashes.hashes, ctx);
        if (materialHashes.computed) {
            UpdateLayer.uploadFactors(material, data.material, ctx);
            UpdateLayer.uploadTextures(material, ctx);
        }

        return RenderItemAssembler.assemble(node, p, data, ctx);
    }
}
