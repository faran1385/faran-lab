import {BufferInternal} from "../internals/BufferInternal.ts";
import {SkinInternal} from "../internals/SkinInternal.ts";
import {schedulePreFrame} from "./PreFrameQueue.ts";
import {Source} from "./Source.ts";
import type {SkinWrapper} from "../wrappers/SkinWrapper.ts";
import type {SkinningMethod} from "../skinning/SkinningMethod.ts";
import type {SkinShaderInfo} from "../producers/AssemblerProducers.ts";

/**
 * Translates a skin: owns the palette buffer and keeps it equal to `jointWorld * inverseBind` for every joint.
 *
 * Nothing drives it from outside. The adapter subscribes to each joint's `worldChanged`, so ANY movement of a joint or
 * of one of its ancestors (a clip, the user, moving the whole character) schedules one palette update in the pre-frame
 * queue, and a quiet frame costs nothing. The update brings the joints' world matrices up to date itself, so it does
 * not depend on the order of the queue.
 *
 * The palette is written in place and queued for upload, never re-created, so it does not touch the epoch. Switching
 * the method replaces the buffer (the stride changes) and tells the nodes using this skin, which rebuild.
 */
export class SkinAdaptor {
    readonly internal: SkinInternal;

    /** Fires when the palette buffer or the method changed. Nodes using this skin rebuild their pipelines. */
    readonly changed = new Source<void>();

    private readonly owner: SkinWrapper;
    private shaderInfo: SkinShaderInfo;

    private readonly task = () => this.ensure();
    private readonly schedule = () => schedulePreFrame(this.task);

    constructor(owner: SkinWrapper) {
        this.owner = owner;

        const method = owner.getMethod();
        this.internal = new SkinInternal(SkinAdaptor.createPalette(method, owner.getJointCount()), method.id);
        this.shaderInfo = SkinAdaptor.shaderInfoOf(method);

        for (const joint of owner.getJoints().keys()) {
            joint.adaptor.worldChanged.subscribe(this.internal.uuid, this.schedule);
        }
        this.schedule();
    }

    /** What the vertex shader needs from the method. Same object until the method is switched. */
    getShaderInfo(): SkinShaderInfo {
        return this.shaderInfo;
    }

    /** Called by the wrapper after `setMethod`. */
    onMethodChanged(): void {
        const method = this.owner.getMethod();
        this.internal.setPalette(SkinAdaptor.createPalette(method, this.owner.getJointCount()), method.id);
        this.shaderInfo = SkinAdaptor.shaderInfoOf(method);
        this.changed.notify();
        this.schedule();
    }

    /** Stops following the joints. Call when the skin is thrown away, or the joints keep it alive. */
    dispose(): void {
        for (const joint of this.owner.getJoints().keys()) {
            joint.adaptor.worldChanged.unsubscribe(this.internal.uuid);
        }
    }

    ensure(): void {
        const joints = this.owner.getJoints();
        for (const joint of joints.keys()) joint.adaptor.ensureWorld();

        const palette = this.internal.getPalette();
        this.owner.getMethod().update(palette.getData(), joints);
        palette.markDirty();
    }

    private static createPalette(method: SkinningMethod, jointCount: number): BufferInternal {
        return new BufferInternal(
            method.initialPalette(jointCount),
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        );
    }

    private static shaderInfoOf(method: SkinningMethod): SkinShaderInfo {
        return {id: method.id, code: method.code, paletteElement: method.paletteElement};
    }
}
