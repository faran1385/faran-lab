import {type Counts, formatCounts, MANAGER_NAMES, Rig, type Snapshot, type StepResult} from "./rig.ts";
import {ms, type TestCtx} from "./util.ts";

/** A rig whose GPU device is destroyed when the scenario ends. */
export async function newRig(ctx: TestCtx): Promise<Rig> {
    const rig = await Rig.create(ctx.host);
    ctx.onCleanup(() => rig.dispose());
    return rig;
}

function sample(items: string[], n = 4): string {
    const head = items.slice(0, n).map((s) => (s.length > 18 ? `${s.slice(0, 18)}…` : s)).join(", ");
    return items.length > n ? `${head}, +${items.length - n} more` : head;
}

/** No GPU validation / OOM / internal / uncaptured errors since the last call. */
export function gpuClean(ctx: TestCtx, rig: Rig, label: string): boolean {
    const errors = rig.takeGpuErrors();
    if (errors.length === 0) return true;
    const unique = [...new Set(errors)];
    ctx.fail(`${label}: ${errors.length} GPU error(s): ${unique.slice(0, 3).join(" | ")}`);
    return false;
}

/**
 * Trackers with 0 refs are never in any pending-delete set, so they can never be collected: a resource that was
 * ensure()d but never acquired is a permanent leak. The renderer's own static resources are exempt (baseline).
 */
export function noOrphans(ctx: TestCtx, rig: Rig, label: string): boolean {
    const snap = rig.snapshot();
    let ok = true;
    for (const name of MANAGER_NAMES) {
        const baseline = new Set(rig.baseline[name].keys);
        const orphans = snap[name].zeroRef.filter((k) => !baseline.has(k));
        if (orphans.length > 0) {
            ok = false;
            ctx.fail(`${label}: ${name} has ${orphans.length} tracker(s) with 0 refs that will never be collected (${sample(orphans)})`);
        }
    }
    return ok;
}

/**
 * Empty the scene with `teardown`, render a few frames and check every manager is back to the empty-scene baseline:
 * nothing the scene created may outlive it.
 */
export async function leakFree(ctx: TestCtx, rig: Rig, label: string, teardown: () => void): Promise<boolean> {
    teardown();
    await rig.render(3);
    gpuClean(ctx, rig, `${label} (teardown)`);

    const snap = rig.snapshot();
    let ok = true;
    for (const name of MANAGER_NAMES) {
        const baseline = new Set(rig.baseline[name].keys);
        const extra = snap[name].keys.filter((k) => !baseline.has(k));
        const missing = rig.baseline[name].keys.filter((k) => !snap[name].keys.includes(k));
        if (extra.length > 0) {
            ok = false;
            ctx.fail(`${label}: LEAK, ${name} still holds ${extra.length} resource(s) after the scene was emptied (${sample(extra)})`);
        }
        if (missing.length > 0) {
            ok = false;
            ctx.fail(`${label}: ${name} lost ${missing.length} static renderer resource(s) (${sample(missing)})`);
        }
    }
    return ok;
}

/** The same set of live resources as `before`, key for key. */
export function sameResources(ctx: TestCtx, rig: Rig, label: string, before: Snapshot): boolean {
    const now = rig.snapshot();
    let ok = true;
    for (const name of MANAGER_NAMES) {
        const a = new Set(before[name].keys);
        const b = new Set(now[name].keys);
        const gone = [...a].filter((k) => !b.has(k));
        const added = [...b].filter((k) => !a.has(k));
        if (gone.length > 0 || added.length > 0) {
            ok = false;
            ctx.fail(`${label}: ${name} differs from before (${added.length} new, ${gone.length} gone)`);
        }
    }
    return ok;
}

export interface StepExpectation {
    /**
     * GPU objects created, per manager. When given it is exact: a manager that is not listed must have created nothing.
     * Leave it out to not check creation at all.
     */
    created?: Partial<Counts>;
    /** queue.writeBuffer calls (in-place uploads). */
    bufferWrites?: number;
    /** queue.writeTexture calls. */
    textureWrites?: number;
    /** "none": the engine computed no hash at all. "some": it computed at least one. */
    hashing?: "none" | "some";
    /** "still": no stamp anywhere, the epoch did not move. "moved": at least one stamp. */
    epoch?: "still" | "moved";
}

/** Compares what a step cost with what it should have cost. Returns true when everything matched. */
export function expectStep(ctx: TestCtx, label: string, step: StepResult, expected: StepExpectation): boolean {
    let ok = true;

    if (expected.created) {
        const want: Partial<Counts> = expected.created;
        const wrong = MANAGER_NAMES.filter((n) => step.created[n] !== (want[n] ?? 0));
        if (wrong.length > 0) {
            ok = false;
            ctx.fail(`${label}: created ${formatCounts(step.created)}, expected ${formatCounts(want)}`);
        }
    }
    if (expected.bufferWrites !== undefined && step.bufferWrites !== expected.bufferWrites) {
        ok = false;
        ctx.fail(`${label}: ${step.bufferWrites} buffer write(s), expected ${expected.bufferWrites}`);
    }
    if (expected.textureWrites !== undefined && step.textureWrites !== expected.textureWrites) {
        ok = false;
        ctx.fail(`${label}: ${step.textureWrites} texture write(s), expected ${expected.textureWrites}`);
    }
    if (expected.hashing === "none" && step.hashCalls !== 0) {
        ok = false;
        ctx.fail(`${label}: computed ${step.hashCalls} hash(es), expected none (a change that touches no identity must not hash anything)`);
    }
    if (expected.hashing === "some" && step.hashCalls === 0) {
        ok = false;
        ctx.fail(`${label}: computed no hash, but the change should have been picked up through a hash`);
    }
    if (expected.epoch === "still" && step.epochBumps !== 0) {
        ok = false;
        ctx.fail(`${label}: the epoch moved by ${step.epochBumps}, expected it to stay (the change must not stamp anything)`);
    }
    if (expected.epoch === "moved" && step.epochBumps === 0) {
        ok = false;
        ctx.fail(`${label}: the epoch did not move, so cached render items would never be rebuilt`);
    }
    return ok;
}

/** The common end-of-step bundle: expectations met, no GPU errors, no orphan trackers. */
export function afterStep(ctx: TestCtx, rig: Rig, label: string, step: StepResult, expected: StepExpectation): boolean {
    const met = expectStep(ctx, label, step, expected);
    const clean = gpuClean(ctx, rig, label);
    const orphans = noOrphans(ctx, rig, label);
    return met && clean && orphans;
}

/** Nothing changed, so a frame must cost nothing: no GPU object, no upload, no hash, no stamp. */
export async function quietFrames(ctx: TestCtx, rig: Rig, label: string, frames = 3): Promise<boolean> {
    const step = await rig.step(() => {
    }, frames);
    return afterStep(ctx, rig, label, step, {
        created: {},
        bufferWrites: 0,
        textureWrites: 0,
        hashing: "none",
        epoch: "still",
    });
}

/** Same comparison as expectStep, but a mismatch is a warning (a design / efficiency expectation, not a broken invariant). */
export function hintStep(ctx: TestCtx, label: string, step: StepResult, expected: StepExpectation): boolean {
    const soft = {
        fail: (message: string) => {
            ctx.warn(false, message);
        },
    } as unknown as TestCtx;
    return expectStep(soft, label, step, expected);
}

export const NOTHING: Partial<Counts> = {};

export interface TriggerOptions {
    /** Efficiency expectations: a mismatch is a warning. */
    hint?: StepExpectation;
    /** After the change has settled, the number of live resources per manager must be what it was before (a swap, not a leak). */
    sameAfter?: boolean;
}

/**
 * One change: run `mutate`, render one frame, check what it cost, let the engine settle for two frames (so released
 * resources are collected) and check it is quiet again. Prints one console.log line with the numbers.
 */
export async function trigger(
    ctx: TestCtx,
    rig: Rig,
    label: string,
    mutate: () => void,
    expected: StepExpectation,
    options: TriggerOptions = {},
): Promise<StepResult> {
    const before = rig.snapshot();
    const step = await rig.step(mutate, 1);
    afterStep(ctx, rig, label, step, expected);
    if (options.hint) hintStep(ctx, label, step, options.hint);
    ctx.perf(`${label}: created ${formatCounts(step.created)} | ${step.bufferWrites} buffer + ${step.textureWrites} texture write(s) | ${step.hashCalls} hash(es) | epoch +${step.epochBumps} | render() ${ms(step.frameMs)}`);

    await rig.render(2);
    gpuClean(ctx, rig, `${label} (settling)`);
    await quietFrames(ctx, rig, `${label}: idle afterwards`, 2);
    if (options.sameAfter) sameCount(ctx, rig, label, before);
    return step;
}

/** Live resources per manager are what they were: the change swapped things, it did not leak or lose any. */
export function sameCount(ctx: TestCtx, rig: Rig, label: string, before: Snapshot): void {
    const now = rig.snapshot();
    const wrong: string[] = [];
    for (const name of MANAGER_NAMES) {
        if (now[name].keys.length !== before[name].keys.length) {
            wrong.push(`${name} ${before[name].keys.length} -> ${now[name].keys.length}`);
        }
    }
    ctx.check(wrong.length === 0, `${label}: live resources changed although the change was a swap (${wrong.join(", ")})`);
}
