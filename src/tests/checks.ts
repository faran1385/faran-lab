import {MANAGER_NAMES, type ManagerName, Rig, type Snapshot} from "./rig.ts";
import {Sim} from "./sim.ts";
import type {TestCtx} from "./util.ts";

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

/** The renderer's pixels equal what the model says they should be. */
export async function pixelsMatch(ctx: TestCtx, sim: Sim, label: string): Promise<boolean> {
    const mismatches = await sim.verify();
    if (mismatches.length === 0) return true;
    ctx.fail(`${label}: ${mismatches.length} pixel mismatch(es). ${mismatches.slice(0, 3).join(" | ")}`);
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

/** Remove everything and check the managers are back to the empty-scene baseline. */
export async function leakFree(ctx: TestCtx, rig: Rig, sim: Sim, label: string): Promise<boolean> {
    sim.removeAll();
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

export function describeDiff(a: Snapshot, b: Snapshot): string[] {
    const out: string[] = [];
    for (const name of MANAGER_NAMES) {
        const ca = a[name].keys.length;
        const cb = b[name].keys.length;
        if (ca !== cb) out.push(`${name}: ${ca} alive vs ${cb} in a from-scratch build`);
        const ra = a[name].refs.join(",");
        const rb = b[name].refs.join(",");
        if (ra !== rb) out.push(`${name} refcounts [${a[name].refs.join(",")}] vs [${b[name].refs.join(",")}]`);
    }
    return out;
}

/**
 * The reference check: build the model's final state from scratch on a second renderer. The incrementally updated
 * renderer must end up with the same number of live resources and the same refcount distribution, and must draw the
 * same pixels (the oracle is applied to the scratch build too, so a harness bug cannot hide behind it).
 */
export async function equivalentToScratch(ctx: TestCtx, rig: Rig, sim: Sim, label: string): Promise<boolean> {
    await rig.render(3);
    const incremental = rig.snapshot();

    const scratch = await Rig.create(ctx.host);
    try {
        const fresh = Sim.build(scratch, sim.model);
        await scratch.render(3);
        gpuClean(ctx, scratch, `${label} (scratch build)`);
        const scratchMismatch = await fresh.verify();
        if (scratchMismatch.length > 0) {
            ctx.fail(`${label}: harness sanity, from-scratch build disagrees with the oracle: ${scratchMismatch.slice(0, 2).join(" | ")}`);
        }
        const diffs = describeDiff(incremental, scratch.snapshot());
        if (diffs.length > 0) {
            ctx.fail(`${label}: incremental state != from-scratch state. ${diffs.slice(0, 4).join(" | ")}`);
            return false;
        }
        return true;
    } finally {
        scratch.dispose();
    }
}

/** Resources a quiet frame created: must be none. */
export async function quietFramesCreateNothing(ctx: TestCtx, rig: Rig, label: string, frames = 5): Promise<boolean> {
    rig.resetCreated();
    await rig.render(frames);
    const made = MANAGER_NAMES.filter((n: ManagerName) => rig.created[n] > 0)
        .map((n) => `${n}:${rig.created[n]}`);
    if (made.length === 0) return true;
    ctx.fail(`${label}: ${frames} idle frames still created GPU resources (${made.join(" ")})`);
    return false;
}

/** The common end-of-step bundle: no GPU errors, pixels right, no orphan trackers. */
export async function stateIsSane(ctx: TestCtx, rig: Rig, sim: Sim, label: string): Promise<boolean> {
    const clean = gpuClean(ctx, rig, label);
    const pixels = await pixelsMatch(ctx, sim, label);
    const orphans = noOrphans(ctx, rig, label);
    const afterReadback = gpuClean(ctx, rig, `${label} (readback frame)`);
    return clean && pixels && orphans && afterReadback;
}
