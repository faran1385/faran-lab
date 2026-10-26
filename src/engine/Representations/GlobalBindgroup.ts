import {BindgroupInteractor} from "./BindgroupInteractor.ts";
import {BufferInternal} from "../internals/BufferInternal.ts";

/**
 * The group-0 bind group of every engine-built pipeline: one uniform buffer holding the active camera's view and
 * projection matrices (2 x mat4 = 128 bytes). Also reachable as `Renderer.globalBindgroupInteractor`.
 *
 * There is exactly ONE of these, shared by every renderer, and it never changes (it is locked). It is only a
 * description: each renderer resolves it through its own managers, so each gets its own GPUBuffer and GPUBindGroup on
 * its own device, and writes its own camera into that copy before drawing (see Renderer.render). What changes when the
 * camera changes is the buffer's contents, never its identity, so a cached render item's group 0 can never go stale,
 * and a node's pipeline never holds anything that belongs to one renderer.
 *
 * Hand-authored pipelines can bind it at any group: `pipeline.setBindgroup(group, Renderer.globalBindgroupInteractor)`.
 *
 * This file lives apart from the Renderer so the adapters can import it without pulling the renderer in. It is
 * evaluated at import time, where `GPUBufferUsage` / `GPUShaderStage` may not exist (SSR, node), so the flags are
 * written out as numbers.
 */

/** GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST */
const UNIFORM_COPY_DST = 0x0040 | 0x0008;
/** GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT */
const VERTEX_FRAGMENT = 0x1 | 0x2;

/** Two mat4: view at byte offset 0, projection at byte offset 64. The same layout as the Camera's own buffer. */
export const GLOBAL_BUFFER_BYTES = 128;

/**
 * The CPU side of the global buffer. It is never uploaded through the upload queue (that queue is global, so another
 * renderer could drain it): each renderer writes its own GPU copy directly.
 */
export const globalBuffer = new BufferInternal(new ArrayBuffer(GLOBAL_BUFFER_BYTES), UNIFORM_COPY_DST);

export const globalBindgroupInteractor = new BindgroupInteractor({
    entries: [{type: "uniform", binding: 0, resource: globalBuffer, visibility: VERTEX_FRAGMENT}],
    isLocked: true,
});
