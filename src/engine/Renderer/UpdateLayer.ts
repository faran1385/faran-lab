import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {GeometryHashes, MaterialHashes} from "../hashing/HashData.ts";
import type {RenderContext} from "./RenderContext.ts";

/**
 * The update layer: decides what has to be redone, from hashes and flags. It never computes a hash and never
 * creates a GPU resource.
 */
export class UpdateLayer {
    /**
     * Per primitive: must its shaders be regenerated?
     *
     * This replaces Material/GeometryWrapper.needsShaderRebuild(), whose "last seen" state lived on the shared
     * wrapper, so with several primitives on one material only the first ever saw the change and the rest kept stale
     * shader code. Here the last-seen key lives on the primitive's own pipeline wrapper.
     *
     * The key holds the material's shader hash, its layout hash (the binding plan decides the binding numbers written
     * into the code) and the attribute shape (names and formats, not buffer contents).
     */
    static syncShaderInputs(primitive: PrimitiveWrapper, material: MaterialHashes, geometry: GeometryHashes): boolean {
        const pipeline = primitive.getPipeline();
        const key = `${material.shader}|${material.layout}|${geometry.attributesShape}`;
        if (pipeline.getShaderInputsKey() === key) return false;

        pipeline.setShaderInputsKey(key);
        pipeline.markVertexShaderDirty();
        pipeline.markFragmentShaderDirty();
        return true;
    }

    /**
     * Per material, run once right after its hashes were computed (its factor buffer exists by then): write changed
     * factor values into the uniform buffer. The flag is consumed by exactly one caller, the material itself.
     */
    static uploadFactors(material: MaterialWrapper, hashes: MaterialHashes, ctx: RenderContext): void {
        const {managers, producer} = ctx;

        for (const component of material.getAllComponents()) {
            if (!component.needsFactorUpdate()) continue;

            const item = producer.getFactorPlan(material).get(component.name)!;
            managers.bufferManager.upload(hashes.factors, new Float32Array([item.factor].flat()), item.offset);
            component.syncFactorUpdate();
        }
    }
}
