import {takeQueuedBuffers, takeQueuedImages} from "../internals/UploadQueue.ts";
import type {Camera} from "../Camera/Camera.ts";
import type {RenderContext} from "./RenderContext.ts";

/**
 * The upload layer: writes data that changed in place into GPU resources that already exist. It never decides what
 * a resource is (that is the hash) and never creates one. Nothing is polled: owners register in the upload queue when
 * they change, so a frame in which nothing changed does no work here.
 */
export class UploadLayer {
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

    /** Writes the view and projection matrices into the camera buffer, only when they changed or the camera did. */
    static updateCamera(camera: Camera, ctx: RenderContext, cameraBufferKey: string): void {
        const {managers, cache} = ctx;
        const isTheLastFrameCamera = camera.uuid === cache.lastCameraUUID;

        if (camera.isUploadViewDirty() || !isTheLastFrameCamera) {
            managers.bufferManager.upload(cameraBufferKey, camera.getViewMatrix(), 0);
            camera.syncUploadView();
        }
        if (camera.isUploadProjectionDirty() || !isTheLastFrameCamera) {
            managers.bufferManager.upload(cameraBufferKey, camera.getProjectionMatrix(), 64);
            camera.syncUploadProjection();
        }

        if (!isTheLastFrameCamera) cache.lastCameraUUID = camera.uuid;
    }
}
