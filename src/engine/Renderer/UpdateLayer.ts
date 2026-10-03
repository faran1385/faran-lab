import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {GeometryHashes, MaterialHashes} from "../hashing/utils/HashData.ts";
import type {RenderContext} from "./RenderContext.ts";
import type {Camera} from "../Camera/Camera.ts";
import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";

/**
 * The update layer: decides what has to be redone, from hashes and flags. It never computes a hash and never
 * creates a GPU resource.
 */
export class UpdateLayer {

    private static preAllocatedArray = new Float32Array(4);

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
        if (pipeline.hashProvider.getShaderInputsKey() === key) return false;

        pipeline.hashProvider.setShaderInputsKey(key);
        pipeline.markVertexShaderDirty();
        pipeline.markFragmentShaderDirty();
        return true;
    }


    static updateCamera(camera: Camera, ctx: RenderContext) {

        const {managers, cache, rendererUUID} = ctx

        const isTheLastFrameCamera = camera.uuid === cache.lastCameraUUID;

        if (camera.isUploadViewDirty() || !isTheLastFrameCamera) {
            managers.bufferManager.upload(rendererUUID, camera.getViewMatrix().buffer, 0)
            camera.syncUploadView()
        }
        if (camera.isUploadProjectionDirty() || !isTheLastFrameCamera) {
            managers.bufferManager.upload(rendererUUID, camera.getProjectionMatrix().buffer, 64)
            camera.syncUploadProjection()
        }

        if (!isTheLastFrameCamera) cache.lastCameraUUID = camera.uuid

    }

    /**
     * Per material, run once right after its hashes were computed (its factor buffer exists by then): write changed
     * factor values into the uniform buffer. The flag is consumed by exactly one caller, the material itself.
     */
    static uploadFactors(material: MaterialWrapper, hashes: MaterialHashes, ctx: RenderContext): void {
        const {managers, producer} = ctx;

        if (material.hashProvider.factorNeedsUpdate()) {
            const item = producer.getFactorPlan(material).get("alphaCutOff")!;
            this.preAllocatedArray.set([item.factor as number], 0);
            managers.bufferManager.upload(hashes.factors, this.preAllocatedArray.subarray(0, 1), item.offset);
            material.hashProvider.syncFactorUpdate();
        }

        for (const component of material.getSortedComponents()) {
            if (!component.hashProvider.needsFactorUpdate()) continue;
            const item = producer.getFactorPlan(material).get(component.name)!;
            const length = typeof item.factor === "number" ? 1 : item.factor.length;

            if (length > 1) {
                this.preAllocatedArray.set(item.factor as number[], 0);
            } else {
                this.preAllocatedArray[0] = item.factor as number;
            }

            managers.bufferManager.upload(hashes.factors, this.preAllocatedArray.subarray(0, length), item.offset);
            component.hashProvider.syncFactorUpdate();
        }
    }


    static uploadTextures(material: MaterialWrapper, ctx: RenderContext): void {
        const {managers, producer, hashes} = ctx;

        for (const component of material.getSortedComponents()) {
            const texture = component.getTexture()?.wrapper;
            if (!texture || !texture.getImage().hashProvider.needsUpdate()) continue;
            const image = texture.getImage();
            managers.textureManager.upload(hashes.resolveImage(image), producer.produceTextureUpdate(image));
            texture.getImage().hashProvider.syncNeedsUpdate()
        }
    }

    static updateAttributeBuffers(geometry: GeometryWrapper, hashes: GeometryHashes, ctx: RenderContext): void {
        const {managers} = ctx;

        for (const attribute of geometry.getAttributes().values()) {
            if (!attribute.hashProvider.needsUpdate()) continue;

            managers.bufferManager.upload(hashes.attributeBuffers.get(attribute.name)!, attribute.getData())
            attribute.hashProvider.syncNeedsUpdate()
        }
    }
}
