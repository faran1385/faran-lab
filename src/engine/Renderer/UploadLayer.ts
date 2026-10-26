import {takeQueuedBuffers, takeQueuedImages} from "../internals/UploadQueue.ts";
import type {RenderContext} from "./RenderContext.ts";
import type {Camera} from "../Camera/Camera.ts";
import {globalBuffer} from "../Representations/GlobalBindgroup.ts";

/**
 * Writes changed data into existing GPU resources. It never decides what a resource is (that is the hash) and never
 * creates one. Nothing is polled: owners register in the upload queue when they change, so a quiet frame does no work.
 */
export class UploadLayer {
    /**
     * Uploads only camera matrices that changed for this renderer. Camera identity and versions live in the
     * renderer-owned cache, so two renderers can consume the same Camera independently.
     */
    static updateCamera(camera: Camera, ctx: RenderContext, key: string): void {
        const {managers, cache} = ctx;
        const newCamera = cache.lastCameraUUID !== camera.uuid;
        const data = new Float32Array(globalBuffer.getData());

        if (newCamera || cache.lastCameraViewVersion !== camera.getViewVersion()) {
            const view = camera.getViewMatrix();
            data.set(view, 0);
            managers.bufferManager.upload(key, data.subarray(0, 16), 0);
            cache.lastCameraViewVersion = camera.getViewVersion();
        }

        if (newCamera || cache.lastCameraProjectionVersion !== camera.getProjectionVersion()) {
            const projection = camera.getProjectionMatrix();
            data.set(projection, 16);
            managers.bufferManager.upload(key, data.subarray(16, 32), 64);
            cache.lastCameraProjectionVersion = camera.getProjectionVersion();
        }

        cache.lastCameraUUID = camera.uuid;
    }

    static flush(ctx: RenderContext): void {
        const {managers, producer, hasher} = ctx;
        for (const buffer of takeQueuedBuffers()) {
            const key = buffer.hashProvider.convertToHash();
            // No GPU buffer yet: it will be created from the current data when a node first needs it.
            if (managers.bufferManager.has(key)) {
                const data = buffer.getData();
                if (data.byteLength > managers.bufferManager.getRaw(key).size) {
                    console.warn(`UploadLayer: buffer ${key} grew past its GPU buffer; use a new BufferInternal when the size changes`);
                } else {
                    managers.bufferManager.upload(key, data, 0);
                }
            }
            buffer.hashProvider.syncNeedsUpdate();
        }

        for (const image of takeQueuedImages()) {
            const key = image.hashProvider.convertToHash(hasher);
            if (managers.textureManager.has(key)) {
                managers.textureManager.upload(key, producer.produceTextureUpdate(image));
            }
            image.hashProvider.syncNeedsUpdate();
        }
    }
}
