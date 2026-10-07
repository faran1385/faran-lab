import {Rig} from "./rig.ts";
import {
    geoId,
    REGION_COUNT,
    type AlphaMode,
    type NodeModel,
    type RGBA,
    type RGB,
    type Shape,
    Sim,
    SLOT_COUNT,
    slotPos,
} from "./sim.ts";
import {equivalentToScratch, gpuClean, leakFree, noOrphans, pixelsMatch, quietFramesCreateNothing} from "./checks.ts";
import {Rng, type Scenario, type TestCtx} from "./util.ts";

export interface FuzzOptions {
    seed: number;
    /** Number of render steps. */
    steps: number;
    /** Operations applied before each render (>1 exercises several changes landing in a single frame). */
    batch: number;
    /** Compare against a from-scratch build every N steps (expensive: creates a second device). */
    equivEvery: number;
}

const SHAPES: Shape[] = ["tri", "quad16", "quad32", "quadFlat"];
const ALPHAS: AlphaMode[] = ["opaque", "mask", "blend"];
const FACTORS: RGBA[] = [[1, 1, 1, 1], [1, 0.5, 0.5, 1], [0.5, 1, 0.5, 1], [0.5, 0.5, 1, 1], [1, 1, 0, 1], [0, 1, 1, 1]];
const IMAGES: Array<[string, RGB]> = [["i0", [255, 0, 0]], ["i1", [0, 255, 0]], ["i2", [0, 0, 255]], ["i3", [200, 100, 50]]];
const MATERIALS = ["m0", "m1", "m2", "m3", "m4", "m5"];

function seedCatalog(sim: Sim, rng: Rng): void {
    for (const [id, color] of IMAGES) sim.defineImage(id, color);
    sim.defineSampler("s0", "nearest");
    sim.defineSampler("s1", "linear");
    for (const id of MATERIALS) {
        const textured = rng.chance(0.5);
        sim.defineMaterial(id, {
            color: rng.pick(FACTORS),
            image: textured ? rng.pick(IMAGES)[0] : null,
            sampler: textured ? rng.pick(["s0", "s1"]) : null,
            alphaMode: rng.pick(ALPHAS),
            doubleSided: rng.chance(0.5),
        });
    }
}

function randomGeo(sim: Sim, rng: Rng, region: number): string {
    const id = geoId(region, rng.pick(SHAPES), rng.pick(["ccw", "cw"] as const), rng.int(3));
    sim.defineGeometry(id, {uv: rng.chance(0.8)});
    return id;
}

interface FuzzOp {
    name: string;
    weight: number;
    /** Apply the operation; return a description, or null when it is not applicable right now. */
    run: (sim: Sim, rng: Rng) => string | null;
}

function leaves(sim: Sim): NodeModel[] {
    return [...sim.model.nodes.values()].filter((n) => n.kind === "leaf");
}

function groups(sim: Sim): NodeModel[] {
    return [...sim.model.nodes.values()].filter((n) => n.kind === "group");
}

function livePrims(sim: Sim): Array<{ node: NodeModel; primId: number }> {
    return leaves(sim).flatMap((node) => node.prims.map((p) => ({node, primId: p.id})));
}

function freeSlots(sim: Sim): number[] {
    const used = new Set(leaves(sim).map((n) => n.slot));
    return Array.from({length: SLOT_COUNT}, (_, i) => i).filter((s) => !used.has(s));
}

const OPS: FuzzOp[] = [
    {
        name: "addLeaf", weight: 9, run(sim, rng) {
            const slots = freeSlots(sim);
            if (slots.length === 0) return null;
            const slot = rng.pick(slots);
            const attachedGroups = groups(sim).filter((g) => g.attached);
            const parent = attachedGroups.length > 0 && rng.chance(0.35) ? rng.pick(attachedGroups).id : null;
            const regionsLeft = [0, 1, 2, 3];
            const prims = [];
            const count = 1 + rng.int(3);
            for (let i = 0; i < count; i++) {
                const region = regionsLeft.splice(rng.int(regionsLeft.length), 1)[0];
                prims.push({geo: randomGeo(sim, rng, region), mat: rng.pick(MATERIALS)});
            }
            const id = sim.addLeaf(slot, prims, parent);
            return `addLeaf #${id} slot ${slot} parent ${parent} prims [${prims.map((p) => `${p.geo}/${p.mat}`)}]`;
        },
    },
    {
        name: "addGroup", weight: 2, run(sim, rng) {
            if (groups(sim).length >= 4) return null;
            const t: [number, number, number] = [rng.int(7) * 0.5 - 1.5, rng.int(7) * 0.5 - 1.5, rng.int(3) * 0.25];
            return `addGroup #${sim.addGroup(t)} t=${t}`;
        },
    },
    {
        name: "detach", weight: 4, run(sim, rng) {
            const nodes = [...sim.model.nodes.values()].filter((n) => n.attached);
            if (nodes.length === 0) return null;
            const n = rng.pick(nodes);
            sim.detach(n.id);
            return `detach #${n.id} (${n.kind})`;
        },
    },
    {
        name: "attach", weight: 4, run(sim, rng) {
            const parked = [...sim.model.nodes.values()].filter((n) => !n.attached);
            if (parked.length === 0) return null;
            const n = rng.pick(parked);
            const attachedGroups = groups(sim).filter((g) => g.attached);
            const parent = n.kind === "leaf" && attachedGroups.length > 0 && rng.chance(0.4) ? rng.pick(attachedGroups).id : null;
            sim.attach(n.id, parent);
            return `attach #${n.id} (${n.kind}) parent ${parent}`;
        },
    },
    {
        name: "removeNode", weight: 3, run(sim, rng) {
            const nodes = [...sim.model.nodes.values()];
            if (nodes.length === 0) return null;
            const n = rng.pick(nodes);
            sim.removeNode(n.id);
            return `removeNode #${n.id} (${n.kind})`;
        },
    },
    {
        name: "reparent", weight: 3, run(sim, rng) {
            const movable = leaves(sim).filter((n) => n.attached);
            if (movable.length === 0) return null;
            const n = rng.pick(movable);
            const options: Array<number | null> = [null, ...groups(sim).filter((g) => g.attached).map((g) => g.id)]
                .filter((p) => p !== n.parent);
            if (options.length === 0) return null;
            const parent = rng.pick(options);
            sim.reparent(n.id, parent);
            return `reparent #${n.id} -> ${parent}`;
        },
    },
    {
        name: "addPrim", weight: 5, run(sim, rng) {
            const candidates = leaves(sim).filter((n) => n.prims.length < REGION_COUNT);
            if (candidates.length === 0) return null;
            const n = rng.pick(candidates);
            const used = new Set(n.prims.map((p) => sim.model.geometries.get(p.geo)!.region));
            const region = rng.pick([0, 1, 2, 3].filter((r) => !used.has(r)));
            const geo = randomGeo(sim, rng, region);
            const mat = rng.pick(MATERIALS);
            return `addPrim #${sim.addPrim(n.id, geo, mat)} to node #${n.id}: ${geo}/${mat}`;
        },
    },
    {
        name: "removePrim", weight: 4, run(sim, rng) {
            const prims = livePrims(sim);
            if (prims.length === 0) return null;
            const p = rng.pick(prims);
            sim.removePrim(p.primId);
            return `removePrim #${p.primId} of node #${p.node.id}`;
        },
    },
    {
        name: "swapMaterial", weight: 7, run(sim, rng) {
            const prims = livePrims(sim);
            if (prims.length === 0) return null;
            const p = rng.pick(prims);
            const mat = rng.pick(MATERIALS);
            sim.setPrimMaterial(p.primId, mat);
            return `swapMaterial prim #${p.primId} -> ${mat}`;
        },
    },
    {
        name: "swapGeometry", weight: 6, run(sim, rng) {
            const prims = livePrims(sim);
            if (prims.length === 0) return null;
            const p = rng.pick(prims);
            const region = sim.model.geometries.get(p.node.prims.find((q) => q.id === p.primId)!.geo)!.region;
            const geo = randomGeo(sim, rng, region);
            sim.setPrimGeometry(p.primId, geo);
            return `swapGeometry prim #${p.primId} -> ${geo}`;
        },
    },
    {
        name: "setAlphaMode", weight: 4, run(sim, rng) {
            const mat = rng.pick(MATERIALS);
            const mode = rng.pick(ALPHAS);
            sim.setAlphaMode(mat, mode);
            return `setAlphaMode ${mat} ${mode}`;
        },
    },
    {
        name: "setDoubleSided", weight: 4, run(sim, rng) {
            const mat = rng.pick(MATERIALS);
            const on = rng.chance(0.5);
            sim.setDoubleSided(mat, on);
            return `setDoubleSided ${mat} ${on}`;
        },
    },
    {
        name: "setColor", weight: 3, run(sim, rng) {
            const mat = rng.pick(MATERIALS);
            const color = rng.pick(FACTORS);
            sim.setColor(mat, color);
            return `setColor ${mat} ${color}`;
        },
    },
    {
        name: "setTexture", weight: 4, run(sim, rng) {
            const mat = rng.pick(MATERIALS);
            if (rng.chance(0.25)) {
                sim.setMaterialTexture(mat, null, null);
                return `setTexture ${mat} none`;
            }
            const image = rng.pick(IMAGES)[0];
            const sampler = rng.pick(["s0", "s1"]);
            sim.setMaterialTexture(mat, image, sampler);
            return `setTexture ${mat} ${image}/${sampler}`;
        },
    },
    {
        name: "recolorImage", weight: 2, run(sim, rng) {
            const image = rng.pick(IMAGES)[0];
            const color: RGB = [rng.int(5) * 63, rng.int(5) * 63, rng.int(5) * 63];
            sim.recolorImage(image, color);
            return `recolorImage ${image} ${color}`;
        },
    },
    {
        name: "setSamplerFilter", weight: 2, run(sim, rng) {
            const sampler = rng.pick(["s0", "s1"]);
            const filter = rng.pick(["nearest", "linear"] as const);
            sim.setSamplerFilter(sampler, filter);
            return `setSamplerFilter ${sampler} ${filter}`;
        },
    },
    {
        name: "toggleUv", weight: 3, run(sim, rng) {
            const ids = [...sim.model.geometries.keys()];
            if (ids.length === 0) return null;
            const id = rng.pick(ids);
            const on = !sim.model.geometries.get(id)!.uv;
            sim.setGeometryUv(id, on);
            return `toggleUv ${id} -> ${on}`;
        },
    },
    {
        name: "moveLeaf", weight: 3, run(sim, rng) {
            const slots = freeSlots(sim);
            const all = leaves(sim);
            if (slots.length === 0 || all.length === 0) return null;
            const n = rng.pick(all);
            const slot = rng.pick(slots);
            sim.moveLeaf(n.id, slot);
            return `moveLeaf #${n.id} slot ${n.slot} -> ${slot} (${slotPos(slot).slice(0, 2)})`;
        },
    },
    {
        name: "moveGroup", weight: 2, run(sim, rng) {
            const all = groups(sim);
            if (all.length === 0) return null;
            const g = rng.pick(all);
            const t: [number, number, number] = [rng.int(9) * 0.5 - 2, rng.int(9) * 0.5 - 2, rng.int(3) * 0.25];
            sim.moveGroup(g.id, t);
            return `moveGroup #${g.id} t=${t}`;
        },
    },
    {name: "idle", weight: 2, run: () => "idle"},
];

const TOTAL_WEIGHT = OPS.reduce((sum, op) => sum + op.weight, 0);

function applyRandomOp(sim: Sim, rng: Rng, histogram: Map<string, number>): string {
    for (let attempt = 0; attempt < 20; attempt++) {
        let roll = rng.next() * TOTAL_WEIGHT;
        const op = OPS.find((o) => (roll -= o.weight) < 0) ?? OPS[OPS.length - 1];
        const description = op.run(sim, rng);
        if (description !== null) {
            histogram.set(op.name, (histogram.get(op.name) ?? 0) + 1);
            return description;
        }
    }
    return "idle (no applicable operation)";
}

export async function runFuzz(ctx: TestCtx, opts: FuzzOptions): Promise<void> {
    const rng = new Rng(opts.seed);
    const rig = await Rig.create(ctx.host);
    ctx.onCleanup(() => rig.dispose());
    const sim = new Sim(rig);
    seedCatalog(sim, rng);

    const history: string[] = [];
    const histogram = new Map<string, number>();
    let peakNodes = 0;
    let scratchChecks = 0;
    const stop = (why: string): void => {
        ctx.info(`${why}\nreplay with ?only=${ctx.name}. Last operations:\n  ${history.slice(-14).join("\n  ")}`);
    };

    for (let step = 0; step < opts.steps; step++) {
        try {
            for (let b = 0; b < opts.batch; b++) history.push(`#${step}.${b} ${applyRandomOp(sim, rng, histogram)}`);
        } catch (e) {
            ctx.fail(`harness or engine threw while applying an operation: ${e instanceof Error ? e.stack ?? e.message : e}`);
            return stop("operation threw");
        }

        try {
            await rig.render(rng.chance(0.5) ? 1 : 2);
        } catch (e) {
            ctx.fail(`render threw at step ${step}: ${e instanceof Error ? e.stack ?? e.message : e}`);
            return stop("render threw");
        }

        peakNodes = Math.max(peakNodes, [...sim.model.nodes.values()].filter((n) => sim.effectivelyAttached(n)).length);
        const label = `step ${step}`;
        const ok = gpuClean(ctx, rig, label)
            && await pixelsMatch(ctx, sim, label)
            && noOrphans(ctx, rig, label)
            && gpuClean(ctx, rig, `${label} (readback frame)`);
        if (!ok) return stop(`state broke at step ${step}`);

        if (step % 12 === 11 && !(await quietFramesCreateNothing(ctx, rig, label, 3))) return stop("idle frames created resources");
        if (step % opts.equivEvery === opts.equivEvery - 1) {
            scratchChecks++;
            if (!(await equivalentToScratch(ctx, rig, sim, label))) return stop(`incremental != scratch at step ${step}`);
        }
    }

    const live = [...sim.model.nodes.values()].filter((n) => sim.effectivelyAttached(n)).length;
    scratchChecks++;
    if (!(await equivalentToScratch(ctx, rig, sim, "final state"))) return stop("final state differs from scratch");
    const ops = [...histogram].sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name}:${n}`).join(" ");
    ctx.info(`${opts.steps} steps x ${opts.batch} op(s); peak ${peakNodes} attached nodes, ${live} at the end; ${scratchChecks} from-scratch comparisons\nops: ${ops}`);
    if (!(await leakFree(ctx, rig, sim, "fuzz teardown"))) return stop("leak after teardown");
}

export function fuzzScenarios(seeds: number[], steps: number): Scenario[] {
    const out: Scenario[] = [];
    for (const seed of seeds) {
        out.push({
            name: `fuzz-seed-${seed}`,
            description: `${steps} random operations (one per frame), pixels checked every step, compared with a from-scratch build every 25.`,
            run: (ctx) => runFuzz(ctx, {seed, steps, batch: 1, equivEvery: 25}),
        });
        out.push({
            name: `fuzz-batched-seed-${seed}`,
            description: `${Math.ceil(steps / 3)} frames of 6 simultaneous random operations each.`,
            run: (ctx) => runFuzz(ctx, {seed: seed + 1000, steps: Math.ceil(steps / 3), batch: 6, equivEvery: 15}),
        });
    }
    return out;
}
