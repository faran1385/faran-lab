import type {RenderContext} from "../Renderer/RenderContext.ts";

/**
 * Generic "run this before the frame" queue. It knows nothing about materials, adapters or the renderer.
 *
 * An owner schedules the SAME function reference every time (keep it in a field, never an inline closure), so the Set
 * dedupes: ten setters in a row queue one task. The renderer calls `flushPreFrame()` as the first thing in render().
 *
 * No imports, like epoch.ts, so it can never be part of an import cycle.
 */
export type PreFrameTask = (...args: any[]) => void;

let pending = new Set<PreFrameTask>();

/** Safe to call any number of times: the same function is queued once. */
export function schedulePreFrame(task: PreFrameTask): void {
    pending.add(task);
}

export function hasPendingPreFrame(): boolean {
    return pending.size > 0;
}

/**
 * Runs every queued task. Tasks may schedule more tasks (a dependent adapter being invalidated by a sync); those run
 * in the same flush. A throwing task does not stop the others: the first error is rethrown after the flush.
 */
export function flushPreFrame(ctx: RenderContext): void {
    let rounds = 0;
    let firstError: unknown;
    let failed = false;

    while (pending.size > 0) {
        if (++rounds > 16) {
            throw new Error("PreFrameQueue: tasks keep rescheduling each other (more than 16 rounds)");
        }
        const batch = pending;
        pending = new Set();
        for (const task of batch) {
            try {
                task(ctx);
            } catch (error) {
                if (!failed) {
                    failed = true;
                    firstError = error;
                }
            }
        }
    }

    if (failed) throw firstError;
}
