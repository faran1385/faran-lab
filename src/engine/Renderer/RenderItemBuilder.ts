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
        const mesh = node.getMesh();
        if (!mesh) return [];


        const {cache} = ctx;
        const entry = cache.get(node);

        // Quiet frame: no setter anywhere has run since the last frame, so nothing can have changed. No hashing,
        // no ensure(), no allocation: hand back the items built before.
        if (entry && cache.lastFrameEpoch === getEpoch()) {
            return entry.items;
        }

        // *memoryLeak*
        const primitives = mesh.getAllPrimitives();

        // First time we see this node, its mesh / primitive list changed: build everything.
        if (!entry || node.getStructureChangedAt() > entry.structureBuiltAt) {
            ResourceLayer.node(node, ctx)
            // *memoryLeak*
            const items = primitives.map((p) => RenderItemBuilder.buildPrimitive(node, p, ctx));
            const builtAt = getEpoch(); // after building: building itself may stamp (shader rebuild marks)
            cache.set(node, {
                items,
                primitives,
                builtAt: primitives.map(() => builtAt),
                structureBuiltAt: builtAt,
            });
            return items;
        }

        // Something changed somewhere: rebuild only the primitives whose own stamp (material, geometry, pipeline,
        // and everything under them) is newer than the epoch their item was built at. Nothing is cleared, so a
        // material shared by many primitives is picked up by every one of them.
        for (let i = 0; i < entry.primitives.length; i++) {
            if (entry.primitives[i].getChangedAt() > entry.builtAt[i]) {
                entry.items[i] = RenderItemBuilder.buildPrimitive(node, entry.primitives[i], ctx);
                entry.builtAt[i] = getEpoch();
            }
        }
        return entry.items;
    }

    // ---- primitive-level ----

    private static buildPrimitive(node: NodeWrapper, p: PrimitiveWrapper, ctx: RenderContext): RenderItem {
        const material = p.getMaterial();
        const geometry = p.getGeometry();
        const {hashes, producer} = ctx;

        // hash layer: shared material / geometry hashes are computed by the first primitive that asks
        const materialHashes = hashes.resolveMaterial(material, (m) => producer.getBindingPlan(m));
        const geometryHashes = hashes.resolveGeometry(geometry);

        // update layer, then shader code (this primitive's own code, from its own last-seen key)
        UpdateLayer.syncShaderInputs(p, materialHashes.hashes, geometryHashes.hashes);
        const generated = ShaderCodeLayer.generate(p, ctx);

        // hash layer again: the pipeline hash needs the shader hashes
        const pipelineHashes = hashes.resolvePipeline(p.getPipeline(), materialHashes.hashes, geometryHashes.hashes);
        const data: HashData = {
            material: materialHashes.hashes,
            geometry: geometryHashes.hashes,
            pipeline: pipelineHashes.hashes
        };

        // resource layer: only for what was actually computed
        if (geometryHashes.computed) ResourceLayer.geometry(geometry, data.geometry, ctx);
        if (materialHashes.computed) {
            ResourceLayer.material(material, data.material, ctx);
            UpdateLayer.uploadFactors(material, data.material, ctx);
        }
        if (generated.vertex || generated.fragment) ResourceLayer.shaders(p, data.pipeline, generated, ctx);
        if (pipelineHashes.computed) ResourceLayer.pipeline(p, data, ctx);

        return RenderItemAssembler.assemble(node, p, data, ctx);
    }
}
