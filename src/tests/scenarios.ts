import {MANAGER_NAMES, Rig} from "./rig.ts";
import {geoId, settings, Sim, type Shape, type Winding, type AlphaMode} from "./sim.ts";
import {
    equivalentToScratch,
    gpuClean,
    leakFree,
    noOrphans,
    pixelsMatch,
    quietFramesCreateNothing,
    stateIsSane,
} from "./checks.ts";
import {Rng, type Scenario, type TestCtx} from "./util.ts";

/** Geometry id shorthand: region, shape, winding, instance. */
const G = (region: number, shape: Shape = "tri", winding: Winding = "ccw", inst = 0) => geoId(region, shape, winding, inst);

/** A rig plus a Sim with the catalog of images / samplers / materials the scenarios draw from. */
async function setup(ctx: TestCtx): Promise<{ rig: Rig; sim: Sim }> {
    const rig = await Rig.create(ctx.host);
    ctx.onCleanup(() => rig.dispose());
    const sim = new Sim(rig);

    sim.defineImage("red", [255, 0, 0]);
    sim.defineImage("green", [0, 255, 0]);
    sim.defineImage("blue", [0, 0, 255]);
    sim.defineImage("orange", [200, 100, 50]);
    sim.defineSampler("nearest", "nearest");
    sim.defineSampler("linear", "linear");

    sim.defineMaterial("red", {color: [1, 0, 0, 1]});
    sim.defineMaterial("green", {color: [0, 1, 0, 1]});
    sim.defineMaterial("blue", {color: [0, 0, 1, 1]});
    sim.defineMaterial("redDbl", {color: [1, 0, 0, 1], doubleSided: true});
    sim.defineMaterial("yellowBlend", {color: [1, 1, 0, 1], alphaMode: "blend"});
    sim.defineMaterial("cyanBlendDbl", {color: [0, 1, 1, 1], alphaMode: "blend", doubleSided: true});
    sim.defineMaterial("maskPurple", {color: [0.5, 0, 1, 1], alphaMode: "mask"});
    sim.defineMaterial("texRed", {image: "red", sampler: "nearest"});
    sim.defineMaterial("texOrange", {color: [0.5, 1, 1, 1], image: "orange", sampler: "linear"});
    return {rig, sim};
}

function aliveOf(rig: Rig, name: (typeof MANAGER_NAMES)[number]): number {
    return rig.snapshot()[name].keys.length - rig.baseline[name].keys.length;
}

const scenarios: Scenario[] = [
    {
        name: "empty-scene",
        description: "An empty scene renders for a while: no GPU errors, nothing created, nothing orphaned.",
        async run(ctx) {
            const {rig} = await setup(ctx);
            await rig.render(10);
            gpuClean(ctx, rig, "empty scene");
            await quietFramesCreateNothing(ctx, rig, "empty scene");
            noOrphans(ctx, rig, "empty scene");
        },
    },

    {
        name: "single-node-add-remove",
        description: "Add one node, check it draws, remove it, check everything it owned is released.",
        async run(ctx) {
            const {rig, sim} = await setup(ctx);
            const leaf = sim.addLeaf(5, [{geo: G(0), mat: "red"}]);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "after add");
            ctx.check(aliveOf(rig, "pipeline") === 1, `expected exactly 1 pipeline for 1 primitive, found ${aliveOf(rig, "pipeline")}`);
            await quietFramesCreateNothing(ctx, rig, "steady state");

            sim.removeNode(leaf);
            await rig.render(1);
            const left = MANAGER_NAMES.filter((n) => aliveOf(rig, n) !== 0);
            ctx.warn(left.length === 0, `one frame after removing the node these managers still hold its resources: ${left.join(", ")}`);
            await stateIsSane(ctx, rig, sim, "after remove");
            await leakFree(ctx, rig, sim, "single node");
        },
    },

    {
        name: "shared-wrappers-dedupe",
        description: "16 nodes sharing one material and one geometry: one pipeline, two shader modules, cheap idle frames.",
        async run(ctx) {
            const {rig, sim} = await setup(ctx);
            for (let slot = 0; slot < 16; slot++) sim.addLeaf(slot, [{geo: G(0), mat: "red"}]);
            await rig.render(2);

            ctx.check(rig.created.pipeline === 1, `16 identical primitives created ${rig.created.pipeline} pipelines, expected 1`);
            ctx.check(rig.created.shaderModule === 2, `16 identical primitives created ${rig.created.shaderModule} shader modules, expected 2 (vertex + fragment)`);
            ctx.warn(rig.created.buffer === 19, `buffers created: ${rig.created.buffer}, expected 19 (position + uv0 + 16 node matrices + 1 factors)`);
            ctx.warn(rig.created.bindgroup === 17, `bind groups created: ${rig.created.bindgroup}, expected 17 (16 nodes + 1 material)`);
            ctx.warn(rig.created.bindgroupLayout === 1 && rig.created.pipelineLayout === 1,
                `layouts created: bindgroupLayout ${rig.created.bindgroupLayout}, pipelineLayout ${rig.created.pipelineLayout}, expected 1 each`);

            await stateIsSane(ctx, rig, sim, "16 shared nodes");
            await quietFramesCreateNothing(ctx, rig, "16 shared nodes");
            await equivalentToScratch(ctx, rig, sim, "16 shared nodes");
            await leakFree(ctx, rig, sim, "16 shared nodes");
        },
    },

    {
        name: "identical-distinct-wrappers",
        description: "8 separate but identical materials and geometries must still share pipelines, shaders and layouts.",
        async run(ctx) {
            const {rig, sim} = await setup(ctx);
            for (let i = 0; i < 8; i++) {
                sim.defineMaterial(`dup${i}`, {color: [1, 0.5, 0, 1]});
                sim.addLeaf(i, [{geo: G(0, "tri", "ccw", i), mat: `dup${i}`}]);
            }
            await rig.render(2);

            ctx.check(rig.created.pipeline === 1, `8 identical-looking primitives created ${rig.created.pipeline} pipelines, expected 1`);
            ctx.check(rig.created.shaderModule === 2, `8 identical-looking primitives created ${rig.created.shaderModule} shader modules, expected 2`);
            ctx.warn(rig.created.bindgroupLayout === 1, `bind group layouts created: ${rig.created.bindgroupLayout}, expected 1`);
            ctx.warn(rig.created.pipelineLayout === 1, `pipeline layouts created: ${rig.created.pipelineLayout}, expected 1`);
            ctx.info(`buffers created: ${rig.created.buffer} (buffers and factor buffers are keyed by wrapper identity, not content)`);

            await stateIsSane(ctx, rig, sim, "8 identical wrappers");
            await equivalentToScratch(ctx, rig, sim, "8 identical wrappers");
            await leakFree(ctx, rig, sim, "8 identical wrappers");
        },
    },

    {
        name: "swap-material",
        description: "Switch every primitive's material (plain, textured, double-sided, blend) and back.",
        async run(ctx) {
            const {rig, sim} = await setup(ctx);
            const prims: number[] = [];
            for (let slot = 0; slot < 8; slot++) {
                const leaf = sim.addLeaf(slot, [{geo: G(0), mat: "red"}]);
                prims.push(sim.model.nodes.get(leaf)!.prims[0].id);
            }
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "initial");

            for (const mat of ["texRed", "redDbl", "yellowBlend", "cyanBlendDbl", "maskPurple", "texOrange", "green", "red"]) {
                for (const p of prims) sim.setPrimMaterial(p, mat);
                await rig.render(2);
                await stateIsSane(ctx, rig, sim, `all primitives -> ${mat}`);
            }

            // half and half
            prims.forEach((p, i) => sim.setPrimMaterial(p, i % 2 ? "texOrange" : "blue"));
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "mixed materials");
            await equivalentToScratch(ctx, rig, sim, "mixed materials");
            await leakFree(ctx, rig, sim, "swap-material");
        },
    },

    {
        name: "swap-geometry",
        description: "Cycle one primitive through every shape / winding / index format, under single- and double-sided materials.",
        async run(ctx) {
            const {rig, sim} = await setup(ctx);
            const leaf = sim.addLeaf(6, [{geo: G(2), mat: "red"}]);
            const prim = sim.model.nodes.get(leaf)!.prims[0].id;
            await rig.render(2);

            for (const mat of ["red", "redDbl"]) {
                sim.setPrimMaterial(prim, mat);
                for (const winding of ["ccw", "cw"] as const) {
                    for (const shape of ["tri", "quad16", "quad32", "quadFlat"] as const) {
                        sim.setPrimGeometry(prim, G(2, shape, winding));
                        await rig.render(2);
                        await stateIsSane(ctx, rig, sim, `${mat} / ${shape} / ${winding}`);
                        ctx.check(aliveOf(rig, "pipeline") === 1, `${mat} / ${shape} / ${winding}: ${aliveOf(rig, "pipeline")} pipelines alive for one primitive`);
                    }
                }
            }
            await equivalentToScratch(ctx, rig, sim, "swap-geometry");
            await leakFree(ctx, rig, sim, "swap-geometry");
        },
    },

    {
        name: "alpha-and-sidedness",
        description: "Every alphaMode x doubleSided x winding combination, toggled in place. Double-sided blend needs two pipelines.",
        async run(ctx) {
            const {rig, sim} = await setup(ctx);
            sim.defineMaterial("probe", {color: [0, 1, 0, 1]});
            const leaf = sim.addLeaf(9, [{geo: G(1), mat: "probe"}]);
            const prim = sim.model.nodes.get(leaf)!.prims[0].id;
            await rig.render(2);

            for (const winding of ["ccw", "cw"] as const) {
                sim.setPrimGeometry(prim, G(1, "quad16", winding));
                for (const double of [false, true, false, true]) {
                    for (const alpha of ["opaque", "mask", "blend", "opaque", "blend", "mask"] as AlphaMode[]) {
                        sim.setDoubleSided("probe", double);
                        sim.setAlphaMode("probe", alpha);
                        await rig.render(2);
                        const label = `${winding}, doubleSided=${double}, ${alpha}`;
                        await stateIsSane(ctx, rig, sim, label);
                        const want = double && alpha === "blend" ? 2 : 1;
                        ctx.check(aliveOf(rig, "pipeline") === want, `${label}: ${aliveOf(rig, "pipeline")} pipeline(s) alive, expected ${want}`);
                    }
                }
            }
            await equivalentToScratch(ctx, rig, sim, "alpha-and-sidedness");
            await leakFree(ctx, rig, sim, "alpha-and-sidedness");
        },
    },

    {
        name: "texture-lifecycle",
        description: "Swap, remove, re-add and recolor textures and samplers while materials are shared between nodes.",
        async run(ctx) {
            const {rig, sim} = await setup(ctx);
            sim.addLeaf(0, [{geo: G(0), mat: "texRed"}]);
            sim.addLeaf(1, [{geo: G(0, "quad16"), mat: "texRed"}]);
            sim.addLeaf(2, [{geo: G(0), mat: "texOrange"}]);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "initial");
            ctx.check(aliveOf(rig, "texture") === 2, `${aliveOf(rig, "texture")} textures alive, expected 2 (red, orange)`);

            const steps: Array<[string, () => void]> = [
                ["recolor image red -> blue (in-place data upload)", () => sim.recolorImage("red", [0, 0, 255])],
                ["sampler nearest -> linear", () => sim.setSamplerFilter("nearest", "linear")],
                ["sampler linear -> nearest", () => sim.setSamplerFilter("nearest", "nearest")],
                ["texRed gets the green image", () => sim.setMaterialTexture("texRed", "green", "nearest")],
                ["texRed shares the orange image with texOrange", () => sim.setMaterialTexture("texRed", "orange", "nearest")],
                ["texRed loses its texture", () => sim.setMaterialTexture("texRed", null, null)],
                ["texRed gets the red (now blue) image back", () => sim.setMaterialTexture("texRed", "red", "linear")],
                ["texOrange loses its texture", () => sim.setMaterialTexture("texOrange", null, null)],
                ["texOrange gets texture again", () => sim.setMaterialTexture("texOrange", "green", "linear")],
                ["recolor green image", () => sim.recolorImage("green", [10, 200, 90])],
            ];
            for (const [label, run] of steps) {
                run();
                await rig.render(2);
                await stateIsSane(ctx, rig, sim, label);
            }

            const imagesInUse = new Set<string>();
            for (const n of sim.model.nodes.values()) {
                for (const p of n.prims) {
                    const image = sim.model.materials.get(p.mat)!.image;
                    if (image) imagesInUse.add(image);
                }
            }
            ctx.check(aliveOf(rig, "texture") === imagesInUse.size, `${aliveOf(rig, "texture")} textures alive, expected ${imagesInUse.size} (${[...imagesInUse]})`);

            await equivalentToScratch(ctx, rig, sim, "texture-lifecycle");
            await leakFree(ctx, rig, sim, "texture-lifecycle");
        },
    },

    {
        name: "texture-evict-recreate",
        description: "A texture whose last user goes away is destroyed; when a material needs it again it is re-created. Its pixels must come back.",
        async run(ctx) {
            const previous = settings.reuploadTextures;
            settings.reuploadTextures = false; // this scenario is about exactly that bug, so do not work around it
            ctx.onCleanup(() => {
                settings.reuploadTextures = previous;
            });
            const {rig, sim} = await setup(ctx);
            const leaf = sim.addLeaf(7, [{geo: G(0), mat: "texRed"}]);
            const prim = sim.model.nodes.get(leaf)!.prims[0].id;
            await rig.render(2);
            await pixelsMatch(ctx, sim, "first use of the texture");

            sim.setPrimMaterial(prim, "green"); // nothing references the red image any more -> texture destroyed
            await rig.render(2);
            ctx.check(aliveOf(rig, "texture") === 0, `${aliveOf(rig, "texture")} texture(s) alive after their last user left, expected 0`);

            sim.setPrimMaterial(prim, "texRed"); // texture is created again
            await rig.render(2);
            await pixelsMatch(ctx, sim, "texture used again after being destroyed (needs its pixels uploaded again)");
        },
    },

    {
        name: "image-resize",
        description: "Change an image's dimensions and data in place (a suspected hash bug: the dimensions object is stringified).",
        async run(ctx) {
            const {rig, sim} = await setup(ctx);
            sim.addLeaf(3, [{geo: G(0), mat: "texRed"}]);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "before resize");

            const image = sim.imageWrapper("red");
            const data = new Uint8Array(4 * 4 * 4);
            for (let i = 0; i < 16; i++) data.set([255, 0, 0, 255], i * 4);
            image.setDimensions(4, 4);
            image.setData(data.buffer);
            await rig.render(2);
            const errors = rig.takeGpuErrors();
            ctx.check(errors.length === 0, `resizing an image 2x2 -> 4x4 in place produced GPU errors (the texture keeps its old size): ${[...new Set(errors)].slice(0, 2).join(" | ")}`);
            await pixelsMatch(ctx, sim, "after resize");
        },
    },

    {
        name: "churn-add-remove",
        description: "40 cycles of adding 8 random nodes and removing them again. Resource counts must return to baseline every time.",
        async run(ctx) {
            const {rig, sim} = await setup(ctx);
            const rng = new Rng(2024);
            const mats = ["red", "green", "texRed", "texOrange", "redDbl", "yellowBlend", "cyanBlendDbl", "maskPurple"];
            let worstExtra = 0;

            for (let cycle = 0; cycle < 40; cycle++) {
                for (let i = 0; i < 8; i++) {
                    const slot = rng.int(16);
                    if ([...sim.model.nodes.values()].some((n) => n.slot === slot)) continue;
                    const prims = [{geo: G(rng.int(4), rng.pick(["tri", "quad16", "quad32", "quadFlat"] as const), rng.pick(["ccw", "cw"] as const), rng.int(2)), mat: rng.pick(mats)}];
                    sim.addLeaf(slot, prims);
                }
                await rig.render(1);
                if (!gpuClean(ctx, rig, `churn cycle ${cycle} (populated)`)) return;

                sim.removeAll();
                await rig.render(1);
                if (!gpuClean(ctx, rig, `churn cycle ${cycle} (emptied)`)) return;

                const extra = MANAGER_NAMES.reduce((sum, n) => sum + aliveOf(rig, n), 0);
                worstExtra = Math.max(worstExtra, extra);
                if (extra !== 0) {
                    ctx.fail(`churn cycle ${cycle}: ${extra} resource(s) still alive one frame after the scene was emptied (${MANAGER_NAMES.filter((n) => aliveOf(rig, n) !== 0).map((n) => `${n}:${aliveOf(rig, n)}`).join(" ")})`);
                    return;
                }
            }
            await pixelsMatch(ctx, sim, "after churn");
            await leakFree(ctx, rig, sim, "churn");
        },
    },

    {
        name: "reattach-timing",
        description: "Detach a node and re-attach the very same wrapper after 0, 1, 2 and 5 frames (resources may or may not be gone).",
        async run(ctx) {
            const {rig, sim} = await setup(ctx);
            const a = sim.addLeaf(4, [{geo: G(0), mat: "red"}, {geo: G(1, "quad32"), mat: "texOrange"}]);
            const b = sim.addLeaf(5, [{geo: G(3, "tri", "cw"), mat: "redDbl"}]);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "initial");

            for (const gap of [0, 1, 2, 5, 1, 0]) {
                for (const id of [a, b]) sim.detach(id);
                await rig.render(gap);
                for (const id of [a, b]) sim.attach(id);
                await rig.render(2);
                await stateIsSane(ctx, rig, sim, `re-attached after ${gap} frame(s)`);
            }
            await equivalentToScratch(ctx, rig, sim, "reattach-timing");
            await leakFree(ctx, rig, sim, "reattach-timing");
        },
    },

    {
        name: "hierarchy",
        description: "Groups and children: moving a group, re-parenting, detaching and re-attaching whole subtrees, deleting a parent.",
        async run(ctx) {
            const {rig, sim} = await setup(ctx);
            const g1 = sim.addGroup([0.7, -0.4, 0]);
            const g2 = sim.addGroup([-1.1, 0.3, 0]);
            const a = sim.addLeaf(0, [{geo: G(0), mat: "red"}], g1);
            const b = sim.addLeaf(1, [{geo: G(1), mat: "green"}], g1);
            const c = sim.addLeaf(2, [{geo: G(2), mat: "blue"}], g2);
            const d = sim.addLeaf(3, [{geo: G(3), mat: "texOrange"}], null);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "initial hierarchy");

            sim.moveGroup(g1, [-2, 1.5, 0.5]);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "moved group 1 (children keep their world position)");

            sim.reparent(a, g2);
            sim.reparent(d, g1);
            sim.reparent(c, null);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "re-parented a->g2, d->g1, c->root");

            sim.detach(g1);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "group 1 detached (b and d must vanish)");

            sim.moveGroup(g1, [1, 1, 0]);
            sim.attach(g1);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "group 1 moved while detached, then re-attached");

            sim.removeNode(g2);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "group 2 deleted (a must vanish)");

            sim.addLeaf(8, [{geo: G(0), mat: "cyanBlendDbl"}], g1);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "new child under group 1");
            ctx.check(sim.model.nodes.has(b), "harness sanity: node b is still known");

            await equivalentToScratch(ctx, rig, sim, "hierarchy");
            await leakFree(ctx, rig, sim, "hierarchy");
        },
    },

    {
        name: "primitive-churn",
        description: "Add and remove primitives on a live node, including emptying its mesh completely and refilling it.",
        async run(ctx) {
            const {rig, sim} = await setup(ctx);
            const leaf = sim.addLeaf(10, [{geo: G(0), mat: "red"}]);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "one primitive");

            const added = [
                sim.addPrim(leaf, G(1, "quad16"), "texOrange"),
                sim.addPrim(leaf, G(2, "quadFlat", "cw"), "redDbl"),
                sim.addPrim(leaf, G(3, "quad32"), "cyanBlendDbl"),
            ];
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "four primitives");

            sim.removePrim(added[1]);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "removed a middle primitive");

            for (const p of sim.model.nodes.get(leaf)!.prims.map((p) => p.id)) sim.removePrim(p);
            await rig.render(3);
            await stateIsSane(ctx, rig, sim, "node with an empty mesh");

            sim.addPrim(leaf, G(0, "tri", "ccw", 1), "green");
            sim.addPrim(leaf, G(1), "maskPurple");
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "refilled after being empty");

            await equivalentToScratch(ctx, rig, sim, "primitive-churn");
            await leakFree(ctx, rig, sim, "primitive-churn");
        },
    },

    {
        name: "uv-attribute-toggle",
        description: "Add / remove the uv0 vertex attribute in place under textured materials (vertex layout and shaders change).",
        async run(ctx) {
            const {rig, sim} = await setup(ctx);
            sim.defineGeometry(G(0, "quad16"));
            sim.defineGeometry(G(1, "quadFlat"));
            sim.defineGeometry(G(2, "tri"), {uv: false});
            sim.addLeaf(0, [{geo: G(0, "quad16"), mat: "texRed"}, {geo: G(1, "quadFlat"), mat: "texOrange"}, {geo: G(2), mat: "texRed"}]);
            sim.addLeaf(1, [{geo: G(0, "quad16"), mat: "red"}]);
            await rig.render(2);
            await stateIsSane(ctx, rig, sim, "initial");

            for (let i = 0; i < 4; i++) {
                for (const id of [G(0, "quad16"), G(1, "quadFlat"), G(2)]) {
                    sim.setGeometryUv(id, !sim.model.geometries.get(id)!.uv);
                    await rig.render(2);
                    await stateIsSane(ctx, rig, sim, `toggled uv on ${id}`);
                }
            }
            await equivalentToScratch(ctx, rig, sim, "uv-attribute-toggle");
            await leakFree(ctx, rig, sim, "uv-attribute-toggle");
        },
    },
];

export default scenarios;
