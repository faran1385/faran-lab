import type {BufferInternal} from "./BufferInternal.ts";
import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";

/**
 * Data that changed in place and has to be written to an existing GPU resource.
 *
 * Writing new bytes into a buffer or texture does not change what it IS (its hash is its identity), so it must not
 * stamp the epoch: an animated node would otherwise invalidate every cached render item every frame. Instead the
 * owner registers itself here and the renderer drains the queue at the start of a frame, so a quiet frame costs nothing.
 *
 * One consumer (one renderer) drains it, same as the needs-update flags it complements.
 * No runtime imports, so it can never be part of an import cycle.
 */
const buffers = new Set<BufferInternal>();
const images = new Set<ImageWrapper>();

export function queueBufferUpload(buffer: BufferInternal): void {
    buffers.add(buffer);
}

export function queueImageUpload(image: ImageWrapper): void {
    images.add(image);
}

export function takeQueuedBuffers(): BufferInternal[] {
    const taken = Array.from(buffers);
    buffers.clear();
    return taken;
}

export function takeQueuedImages(): ImageWrapper[] {
    const taken = Array.from(images);
    images.clear();
    return taken;
}
