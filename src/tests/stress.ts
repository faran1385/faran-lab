import {coverage, type Counts, type FrameTiming, formatCounts, MANAGER_NAMES, type Rig} from "./rig.ts";
import {gpuClean, leakFree, newRig, noOrphans, quietFrames} from "./checks.ts";
import {
    gridCell,
    makeGeometry,
    makeMaterial,
    makeMesh,
    makeNode,
    makeTexture,
    nodeOnGrid,
    positionAttribute,
} from "./scenes.ts";
import {PrimitiveWrapper} from "../engine/wrappers/PrimitiveWrapper.ts";
import {MeshWrapper} from "../engine/wrappers/MeshWrapper.ts";
import type {NodeWrapper} from "../engine/wrappers/NodeWrapper.ts";
import {ms, Rng, scaled, type Scenario, summarize, type TestCtx} from "./util.ts";

/**
 * Massive scenes. Each scenario builds a big scene, renders it, prints how long the frames took (console.log + the
 * results page) and checks the engine's scaling behaviour:
 *
 *  - no GPU errors, no orphan trackers, and the scene leaves nothing behind when it is removed
 *  - resource counts scale the way the design says they should (shared things are created once, per-node things once
 *    per node), see `checkAffine` and the per-scenario expectations
 *  - frames in which nothing changed create, upload and hash nothing
 *
 * Times are CPU time of Renderer.render() and "submit until the GPU is done"; they depend on the machine, so they are
 * reported, never asserted.
 */

type Build = (rig: Rig, n: number) => NodeWrapper[];

/** Adds `roots` to the rig's scene. Returns them so the scenario can remove them again. */
function addAll(rig: Rig, roots: NodeWrapper[]): NodeWrapper[] {
    for (const root of roots) rig.scene.addNode(root);
    return roots;
}

function teardown(rig: Rig, roots: NodeWrapper[]): () => void {
    return () => {
        for (const root of roots) rig.scene.removeNode(root);
    };
}

/** Builds the scene and tells how long the wrapper graph took to construct (that is CPU the user pays too). */
function buildTimed(ctx: TestCtx, label: string, build: () => NodeWrapper[]): NodeWrapper[] {
    const start = performance.now();
    const roots = build();
    ctx.perf(`${label}: wrapper graph built in ${ms(performance.now() - start)}`);
    return roots;
}

/**
 * The cold frame (everything gets created), then steady frames (nothing changed), printed with console.log.
 * Returns the cold frame's timing.
 */
async function timeFrames(ctx: TestCtx, rig: Rig, info: string): Promise<FrameTiming> {
    const cold = await rig.timedFrame();
    gpuClean(ctx, rig, "cold frame");
    ctx.perf(`${info} | LARGE FRAME (cold): cpu ${ms(cold.cpuMs)} + gpu ${ms(cold.gpuMs)} = ${ms(cold.totalMs)}`);

    const frames = 30;
    const steady = await rig.timedFrames(frames);
    gpuClean(ctx, rig, "steady frames");
    const s = summarize(steady.cpu);
    ctx.perf(`steady frames x${frames} (nothing changed): cpu median ${ms(s.median)}, p95 ${ms(s.p95)}, max ${ms(s.max)}; gpu drained the batch in ${ms(steady.drainMs)} (${ms(steady.drainMs / frames)} per frame)`);

    ctx.perf(`resources alive: ${formatCounts(rig.addedSinceBaseline())}`);
    return cold;
}

async function expectDrawn(ctx: TestCtx, rig: Rig, minimum = 0.05): Promise<void> {
    const covered = coverage(await rig.readPixels());
    ctx.perf(`pixel coverage ${(covered * 100).toFixed(1)}%`);
    ctx.check(covered >= minimum, `only ${(covered * 100).toFixed(2)}% of the frame is lit; a scene this big must draw something (expected >= ${(minimum * 100).toFixed(0)}%)`);
}

/** Builds the scene with `n` nodes on a fresh renderer and counts the resources it needs. */
async function countFor(ctx: TestCtx, build: Build, n: number): Promise<Counts> {
    const rig = await newRig(ctx);
    try {
        addAll(rig, build(rig, n));
        await rig.render(3);
        gpuClean(ctx, rig, `reference scene (${n} node${n === 1 ? "" : "s"})`);
        return rig.addedSinceBaseline();
    } finally {
        rig.dispose();
    }
}

/**
 * Resource counts must be affine in the node count: counts(N) = counts(p) + (N - p) / p * (counts(2p) - counts(p)),
 * where p is the period of the scene's pattern (1 unless the scene alternates between shapes). Whatever is shared is
 * created once and whatever is per node once per node; anything else (a pipeline per node, a bind group per draw, a
 * buffer that is created twice) shows up as a count that is off the line.
 */
async function checkAffine(ctx: TestCtx, build: Build, n: number, actual: Counts, period: number): Promise<void> {
    const one = await countFor(ctx, build, period);
    const two = await countFor(ctx, build, 2 * period);
    const wrong: string[] = [];
    const perPeriod: Partial<Counts> = {};
    const shared: Partial<Counts> = {};
    for (const name of MANAGER_NAMES) {
        perPeriod[name] = two[name] - one[name];
        shared[name] = one[name] - perPeriod[name]!;
        const expected = one[name] + ((n - period) / period) * perPeriod[name]!;
        if (actual[name] !== expected) wrong.push(`${name} ${actual[name]} (expected ${expected})`);
    }
    ctx.check(wrong.length === 0, `resource counts for ${n} nodes are off the line through the ${period}-node and ${2 * period}-node scenes: ${wrong.join(", ")}`);
    ctx.info(`per ${period === 1 ? "node" : `${period} nodes`} the engine creates: ${formatCounts(perPeriod)}; shared by all: ${formatCounts(shared)}`);
}

// -- scenarios ----------------------------------------------------------------------------------------------------

/** One mesh drawn by a lot of nodes: the case instancing exists for. Everything but the per-node matrix is shared. */
const sharedMesh: Build = (_rig, n) => {
    const mesh = makeMesh(new PrimitiveWrapper(makeMaterial({color: [0.2, 0.8, 0.3]}), makeGeometry()));
    return Array.from({length: n}, (_, i) => nodeOnGrid(mesh, i, n));
};

/** A material (so a primitive, a factors buffer and a bind group) per node. The shader and pipeline must stay shared. */
const uniqueMaterials: Build = (_rig, n) => {
    const geometry = makeGeometry();
    return Array.from({length: n}, (_, i) => {
        const hue = i / n;
        const material = makeMaterial({color: [hue, 1 - hue, 0.5]});
        return nodeOnGrid(makeMesh(new PrimitiveWrapper(material, geometry)), i, n);
    });
};

/** A geometry (different vertex counts, same layout) per node. The pipeline must stay shared. */
const uniqueGeometries: Build = (_rig, n) => {
    const material = makeMaterial({color: [0.9, 0.5, 0.1]});
    return Array.from({length: n}, (_, i) => {
        const geometry = makeGeometry({cols: 1 + (i % 3), rows: 1 + (i % 2), indexed: i % 2 === 0});
        return nodeOnGrid(makeMesh(new PrimitiveWrapper(material, geometry)), i, n);
    });
};

const PRIMITIVES_PER_MESH = 8;

/** Every node draws a mesh of 8 primitives. Draw calls = 8 x nodes. */
const multiPrimitive: Build = (_rig, n) => {
    const geometry = makeGeometry();
    const primitives = Array.from({length: PRIMITIVES_PER_MESH}, (_, i) =>
        new PrimitiveWrapper(makeMaterial({color: [i / PRIMITIVES_PER_MESH, 0.4, 1 - i / PRIMITIVES_PER_MESH]}), geometry));
    return Array.from({length: n}, (_, i) => {
        const mesh = new MeshWrapper();
        for (const primitive of primitives) mesh.setPrimitive(primitive);
        return nodeOnGrid(mesh, i, n);
    });
};

/** A textured material per node, every texture its own image. One texture, one bind group per node; one shared sampler. */
const uniqueTextures: Build = (_rig, n) => {
    const geometry = makeGeometry({uv: true});
    return Array.from({length: n}, (_, i) => {
        const texture = makeTexture(4, [(i * 53) % 256, (i * 97) % 256, 255, 255]);
        const material = makeMaterial({texture});
        return nodeOnGrid(makeMesh(new PrimitiveWrapper(material, geometry)), i, n);
    });
};

function sceneScenario(
    name: string,
    description: string,
    nodes: number,
    build: Build,
    drawsPerNode: number,
    expectations?: (ctx: TestCtx, added: Counts) => void,
    /** How many nodes it takes for the scene's pattern to repeat. */
    period = 1,
): Scenario {
    return {
        name,
        description,
        run: async (ctx) => {
            const n = Math.ceil(scaled(nodes) / period) * period;
            const rig = await newRig(ctx);
            const roots = addAll(rig, buildTimed(ctx, `${n} nodes`, () => build(rig, n)));

            await timeFrames(ctx, rig, `${n} nodes, ${n * drawsPerNode} draw calls`);
            const added = rig.addedSinceBaseline();
            expectations?.(ctx, added);
            await checkAffine(ctx, build, n, added, period);

            await expectDrawn(ctx, rig);
            noOrphans(ctx, rig, name);
            await quietFrames(ctx, rig, "steady state", 5);
            await leakFree(ctx, rig, name, teardown(rig, roots));
        },
    };
}

// -- variants -----------------------------------------------------------------------------------------------------

interface Variant {
    alphaMode: "opaque" | "mask" | "blend";
    doubleSided: boolean;
    uv: boolean;
}

const VARIANTS: Variant[] = [];
for (const alphaMode of ["opaque", "mask", "blend"] as const) {
    for (const doubleSided of [false, true]) {
        for (const uv of [false, true]) VARIANTS.push({alphaMode, doubleSided, uv});
    }
}

/**
 * What the design says: one pipeline per distinct (cull mode, blend, vertex layout). A double-sided blended material
 * draws twice (front faces culled, then back faces culled). Written down here independently of the engine.
 */
function expectedPipelines(variants: Variant[]): number {
    const keys = new Set<string>();
    for (const v of variants) {
        const blend = v.alphaMode === "blend";
        const culls = !v.doubleSided ? ["back"] : blend ? ["front", "back"] : ["none"];
        for (const cull of culls) keys.add(`${cull}|${blend}|${v.uv}`);
    }
    return keys.size;
}

const variantsScenario: Scenario = {
    name: "massive-pipeline-variants",
    description: "Thousands of nodes spread over every alphaMode x doubleSided x vertex-layout combination. The number of pipelines must follow the design (one per distinct cull/blend/layout), not the node count.",
    run: async (ctx) => {
        const n = scaled(6000);
        const rig = await newRig(ctx);

        const meshes = VARIANTS.map((v) => {
            const material = makeMaterial({alphaMode: v.alphaMode, doubleSided: v.doubleSided, color: [0.9, 0.3, 0.6]});
            return makeMesh(new PrimitiveWrapper(material, makeGeometry({uv: v.uv})));
        });
        const roots = addAll(rig, buildTimed(ctx, `${n} nodes`, () =>
            Array.from({length: n}, (_, i) => nodeOnGrid(meshes[i % meshes.length], i, n))));

        await timeFrames(ctx, rig, `${n} nodes over ${VARIANTS.length} material/geometry variants`);
        const added = rig.addedSinceBaseline();

        const pipelines = expectedPipelines(VARIANTS);
        ctx.check(added.pipeline === pipelines, `${added.pipeline} pipelines for ${VARIANTS.length} variants, the design gives ${pipelines}`);
        const vertexLayouts = new Set(VARIANTS.map((v) => v.uv)).size;
        // vertex code depends on the vertex layout, fragment code only on the material's shape (alphaMode is not in it)
        ctx.check(added.shaderModule === vertexLayouts + 1, `${added.shaderModule} shader modules, expected ${vertexLayouts} vertex + 1 fragment`);
        ctx.check(added.pipelineLayout === 1, `${added.pipelineLayout} pipeline layouts, every variant has the same bind group layouts so 1 is expected`);

        await expectDrawn(ctx, rig);
        await quietFrames(ctx, rig, "steady state", 5);
        await leakFree(ctx, rig, "massive-pipeline-variants", teardown(rig, roots));
    },
};

// -- hierarchies --------------------------------------------------------------------------------------------------

/** Column-major mat4: the translation is stored at 12, 13, 14. */
function worldX(node: NodeWrapper): number {
    return node.getWorldMatrix()[12];
}

/**
 * A chain of `depth` nodes, no rotation, scale 1. Wrappers are created root first (the order a loader creates them in)
 * and attached from the leaf up, which is also what a loader does: a subtree is complete before it is attached.
 * Every node below the root is 0.001 along x from its parent; every `meshEvery`-th node and the leaf carry a mesh.
 */
function buildChain(depth: number, mesh: MeshWrapper, meshEvery: number): NodeWrapper[] {
    const nodes = Array.from({length: depth}, (_, i) => {
        const node = makeNode(i === depth - 1 || i % meshEvery === 0 ? mesh : null);
        if (i > 0) node.setTranslation(0.001, 0, 0);
        return node;
    });
    for (let i = depth - 1; i > 0; i--) nodes[i - 1].addChild(nodes[i]);
    return nodes;
}

const hierarchyChain: Scenario = {
    name: "massive-deep-chain",
    description: "Deeper and deeper node chains. Moving the root must reach the leaf with the right matrix, and the transform/structure propagation must not run out of stack at a depth a skeleton could plausibly have.",
    run: async (ctx) => {
        const depths = [100, 1000, 2500, 5000, 10000];
        let deepest = 0;

        for (const depth of depths) {
            const rig = await newRig(ctx);
            const label = `chain of ${depth}`;
            try {
                const mesh = makeMesh(new PrimitiveWrapper(makeMaterial({color: [0.4, 0.7, 1]}), makeGeometry()));
                const chain = buildChain(depth, mesh, 50);
                const attachStart = performance.now();
                rig.scene.addNode(chain[0]);
                const attachMs = performance.now() - attachStart;

                const cold = await rig.timedFrame();
                gpuClean(ctx, rig, `${label} first frame`);
                const meshNodes = chain.filter((n) => n.getMesh()).length;

                const move = performance.now();
                const step = await rig.step(() => chain[0].setTranslation(1, 0, 0));
                const moveMs = performance.now() - move;

                const expected = 1 + (depth - 1) * 0.001;
                const got = worldX(chain[depth - 1]);
                ctx.check(Math.abs(got - expected) < 0.01 + depth * 1e-6, `${label}: the leaf's world x is ${got.toFixed(4)}, expected ${expected.toFixed(4)} (parent matrices not composed down the whole chain)`);
                ctx.check(step.bufferWrites === meshNodes, `${label}: ${step.bufferWrites} matrix uploads, expected one per mesh-carrying node (${meshNodes})`);
                ctx.check(step.hashCalls === 0, `${label}: moving the root hashed ${step.hashCalls} time(s); a transform change must not hash`);
                ctx.perf(`${label}: attach ${ms(attachMs)}, first frame cpu ${ms(cold.cpuMs)} + gpu ${ms(cold.gpuMs)}, moving the root until the frame was done ${ms(moveMs)} (render() ${ms(step.frameMs)})`);

                // adding one more node at the bottom notifies every ancestor: how much does that cost?
                const leafStart = performance.now();
                chain[depth - 1].addChild(makeNode(mesh));
                ctx.perf(`${label}: attaching one node under the leaf took ${ms(performance.now() - leafStart)}`);
                await rig.render(1);
                gpuClean(ctx, rig, `${label} after attaching a node`);
                deepest = depth;
            } catch (e) {
                const overflow = e instanceof RangeError;
                const message = e instanceof Error ? e.message : String(e);
                if (depth <= 1000) ctx.fail(`${label}: ${overflow ? "stack overflow" : "error"} at a depth skeletons reach: ${message}`);
                else ctx.warn(false, `${label}: ${overflow ? "stack overflow" : "error"}: ${message}. The deepest chain that worked was ${deepest}. Transform invalidation and ensureWorld recurse once per level.`);
                break;
            } finally {
                rig.dispose();
            }
        }
        ctx.perf(`deepest chain that worked: ${deepest}`);
    },
};

interface Tree {
    root: NodeWrapper;
    all: NodeWrapper[];
    /** The first child of the root and everything below it. */
    subtree: NodeWrapper[];
    /** The first leaf. */
    leaf: NodeWrapper;
}

/** root -> 10 -> 10 -> 10 -> `leaves` children each; every node carries the mesh and is 0.001 along x from its parent. */
function buildTree(mesh: MeshWrapper, leaves: number): Tree {
    const all: NodeWrapper[] = [];
    const grow = (levels: number[]): NodeWrapper => {
        const node = makeNode(mesh);
        node.setTranslation(0.001, 0, 0);
        all.push(node);
        if (levels.length > 0) {
            for (let i = 0; i < levels[0]; i++) node.addChild(grow(levels.slice(1)));
        }
        return node;
    };
    const root = grow([10, 10, 10, leaves]);

    const subtree: NodeWrapper[] = [];
    const collect = (node: NodeWrapper) => {
        subtree.push(node);
        node.getChildren().forEach(collect);
    };
    collect(root.getChildren()[0]);

    let leaf = root;
    while (leaf.getChildren().length > 0) leaf = leaf.getChildren()[0];
    return {root, all, subtree, leaf};
}

const hierarchyTree: Scenario = {
    name: "massive-wide-tree",
    description: "A tree of ~11k mesh-carrying nodes. A transform change uploads exactly the matrices of the moved subtree and hashes nothing; adding and removing the whole tree leaves nothing behind.",
    run: async (ctx) => {
        const rig = await newRig(ctx);
        const mesh = makeMesh(new PrimitiveWrapper(makeMaterial({color: [1, 0.8, 0.2]}), makeGeometry()));
        const start = performance.now();
        const {root, all, subtree, leaf} = buildTree(mesh, scaled(10));
        ctx.perf(`${all.length} nodes: wrapper graph built in ${ms(performance.now() - start)}`);

        rig.scene.addNode(root);
        await timeFrames(ctx, rig, `${all.length} nodes in a tree (5 levels), ${all.length} draw calls`);

        const whole = await rig.step(() => root.setTranslation(0.5, 0, 0));
        ctx.check(whole.bufferWrites === all.length, `moving the root: ${whole.bufferWrites} matrix uploads, expected ${all.length} (every node of the tree)`);
        ctx.check(whole.hashCalls === 0 && whole.epochBumps === 0, `moving the root hashed ${whole.hashCalls} time(s) and moved the epoch by ${whole.epochBumps}; both must be 0`);
        ctx.check(Object.values(whole.created).every((c) => c === 0), `moving the root created GPU objects (${formatCounts(whole.created)})`);
        ctx.perf(`moved the whole tree (${all.length} nodes): render() ${ms(whole.frameMs)}`);

        const sub = await rig.step(() => subtree[0].setTranslation(-0.5, 0, 0));
        ctx.check(sub.bufferWrites === subtree.length, `moving one subtree: ${sub.bufferWrites} matrix uploads, expected ${subtree.length}`);
        ctx.perf(`moved one subtree (${subtree.length} nodes): render() ${ms(sub.frameMs)}`);

        const one = await rig.step(() => leaf.setTranslation(0.25, 0.25, 0));
        ctx.check(one.bufferWrites === 1, `moving one leaf: ${one.bufferWrites} matrix uploads, expected 1 (siblings and ancestors are untouched)`);
        ctx.perf(`moved one leaf: render() ${ms(one.frameMs)}`);
        gpuClean(ctx, rig, "moving nodes");

        await expectDrawn(ctx, rig, 0.001);
        await quietFrames(ctx, rig, "steady state", 5);
        await leakFree(ctx, rig, "massive-wide-tree", () => rig.scene.removeNode(root));
    },
};

// -- other axes ---------------------------------------------------------------------------------------------------

const hugeGeometry: Scenario = {
    name: "massive-geometry",
    description: "One mesh with about two million indexed triangles: very large vertex and index buffers, created and uploaded once.",
    run: async (ctx) => {
        const side = Math.max(2, Math.round(1024 * Math.sqrt(scaled(1))));
        const rig = await newRig(ctx);

        const start = performance.now();
        const geometry = makeGeometry({cols: side, rows: side, indexed: true});
        ctx.perf(`${side}x${side} cells: ${(side * side * 2).toLocaleString()} triangles generated in ${ms(performance.now() - start)}`);
        const node = makeNode(makeMesh(new PrimitiveWrapper(makeMaterial({color: [0.3, 0.6, 1]}), geometry)), [0, 0, 0], 6);
        rig.scene.addNode(node);

        await timeFrames(ctx, rig, `${(side * side * 2).toLocaleString()} triangles, 1 draw call`);
        const added = rig.addedSinceBaseline();
        // position buffer, index buffer, node matrix, factors
        ctx.check(added.buffer === 4, `${added.buffer} buffers for one mesh, expected 4 (positions, indices, node matrix, factors)`);
        await expectDrawn(ctx, rig, 0.5);

        // replacing the vertex data with same-sized data is an upload, not a new buffer
        const attribute = geometry.getAttribute("position")!;
        const copy = new Float32Array(attribute.getData().slice(0));
        const rewrite = await rig.step(() => geometry.setAttribute(positionAttribute(copy)));
        ctx.perf(`replaced ${(copy.byteLength / 1048576).toFixed(1)} MB of vertex data: render() ${ms(rewrite.frameMs)}, ${rewrite.bufferWrites} write(s), created ${formatCounts(rewrite.created)}`);
        ctx.check(rewrite.bufferWrites === 1, `same-sized vertex data took ${rewrite.bufferWrites} buffer writes, expected 1`);
        ctx.check(Object.values(rewrite.created).every((c) => c === 0), `same-sized vertex data created GPU objects (${formatCounts(rewrite.created)}), expected an in-place upload`);
        gpuClean(ctx, rig, "geometry rewrite");

        await leakFree(ctx, rig, "massive-geometry", () => rig.scene.removeNode(node));
    },
};

const sharedTexture: Scenario = {
    name: "massive-shared-texture",
    description: "Thousands of nodes whose materials all use one texture: one texture, one sampler, however many nodes.",
    run: async (ctx) => {
        const n = scaled(5000);
        const rig = await newRig(ctx);
        const texture = makeTexture(8, [255, 128, 0, 255]);
        const geometry = makeGeometry({uv: true});
        const roots = addAll(rig, buildTimed(ctx, `${n} nodes`, () =>
            Array.from({length: n}, (_, i) =>
                nodeOnGrid(makeMesh(new PrimitiveWrapper(makeMaterial({texture}), geometry)), i, n))));

        await timeFrames(ctx, rig, `${n} nodes, ${n} materials, one shared texture`);
        const added = rig.addedSinceBaseline();
        ctx.check(added.texture === 1, `${added.texture} GPU textures for one shared image, expected 1`);
        ctx.check(added.sampler === 1, `${added.sampler} GPU samplers for one shared sampler, expected 1`);
        ctx.check(added.pipeline === 1, `${added.pipeline} pipelines, expected 1 (all materials have the same shape)`);
        await quietFrames(ctx, rig, "steady state", 5);
        await leakFree(ctx, rig, "massive-shared-texture", teardown(rig, roots));
    },
};

const churn: Scenario = {
    name: "massive-churn",
    description: "Rounds of adding thousands of nodes with fresh materials, removing half of them at random, then removing all. Frames stay valid, and when the scene is empty every manager is back to its baseline.",
    run: async (ctx) => {
        const rig = await newRig(ctx);
        const rng = new Rng(7);
        const perRound = scaled(3000);
        const rounds = 6;
        const geometry = makeGeometry();
        const live: NodeWrapper[] = [];
        let peak = 0;

        for (let round = 1; round <= rounds; round++) {
            const addStep = await rig.step(() => {
                for (let i = 0; i < perRound; i++) {
                    const hue = rng.next();
                    const material = makeMaterial({color: [hue, 1 - hue, rng.next()]});
                    const node = nodeOnGrid(makeMesh(new PrimitiveWrapper(material, geometry)), i, perRound);
                    rig.scene.addNode(node);
                    live.push(node);
                }
            });
            gpuClean(ctx, rig, `round ${round} add`);

            const removeCount = Math.floor(live.length / 2);
            const removed = await rig.step(() => {
                for (let i = 0; i < removeCount; i++) {
                    const at = rng.int(live.length);
                    rig.scene.removeNode(live[at]);
                    live.splice(at, 1);
                }
            });
            gpuClean(ctx, rig, `round ${round} remove`);

            peak = Math.max(peak, live.length);
            ctx.perf(`round ${round}: +${perRound} nodes: render() ${ms(addStep.frameMs)} (created ${formatCounts(addStep.created)}); -${removeCount} nodes: render() ${ms(removed.frameMs)}; ${live.length} nodes live`);
            noOrphans(ctx, rig, `round ${round}`);
        }

        const alive = rig.addedSinceBaseline();
        // every live node holds a node matrix buffer + a factors buffer, and one bind group each
        ctx.check(alive.buffer === 2 * live.length + 1 && alive.bindgroup === 2 * live.length + 1,
            `${live.length} live nodes hold ${alive.buffer} buffers / ${alive.bindgroup} bind groups, expected ${2 * live.length + 1} each (2 per node + the shared geometry buffer / scene bind group)`);

        await expectDrawn(ctx, rig, 0.01);
        await leakFree(ctx, rig, "massive-churn", () => {
            for (const node of live) rig.scene.removeNode(node);
        });
    },
};

const animated: Scenario = {
    name: "massive-animated",
    description: "A big static scene where 5% of the nodes move every frame for 40 frames. Each frame uploads exactly the moved matrices and nothing else: no GPU objects, no hashing, no stamps.",
    run: async (ctx) => {
        const n = scaled(20000);
        const rig = await newRig(ctx);
        const mesh = makeMesh(new PrimitiveWrapper(makeMaterial({color: [0.9, 0.9, 0.3]}), makeGeometry()));
        const roots = addAll(rig, buildTimed(ctx, `${n} nodes`, () => Array.from({length: n}, (_, i) => nodeOnGrid(mesh, i, n))));

        await timeFrames(ctx, rig, `${n} nodes, ${n} draw calls`);

        const moved = Math.max(1, Math.floor(n * 0.05));
        const rng = new Rng(11);
        const frames = 40;
        const cpu: number[] = [];
        let wrongWrites = 0;
        let hashed = 0;
        let stamped = 0;
        let created = 0;
        for (let f = 0; f < frames; f++) {
            const picked = new Set<number>();
            while (picked.size < moved) picked.add(rng.int(n));
            const step = await rig.step(() => {
                for (const i of picked) {
                    const cell = gridCell(i, n);
                    roots[i].setTranslation(cell.x + Math.sin(f) * 0.01, cell.y, 0);
                }
            });
            cpu.push(step.frameMs);
            if (step.bufferWrites !== moved) wrongWrites++;
            hashed += step.hashCalls;
            stamped += step.epochBumps;
            created += Object.values(step.created).reduce((a, b) => a + b, 0);
        }
        const s = summarize(cpu);
        ctx.perf(`animation: ${moved} of ${n} nodes move per frame, ${frames} frames: render() cpu median ${ms(s.median)}, p95 ${ms(s.p95)}, max ${ms(s.max)}`);
        ctx.check(wrongWrites === 0, `${wrongWrites} frame(s) uploaded a different number of matrices than the ${moved} that moved`);
        ctx.check(hashed === 0, `animating transforms computed ${hashed} hash(es) over ${frames} frames, expected 0`);
        ctx.check(stamped === 0, `animating transforms moved the epoch ${stamped} time(s), expected 0 (an animated node would invalidate every cached item)`);
        ctx.check(created === 0, `animating transforms created ${created} GPU object(s), expected 0`);
        gpuClean(ctx, rig, "animation");

        await leakFree(ctx, rig, "massive-animated", teardown(rig, roots));
    },
};

const mixed: Scenario = {
    name: "massive-mixed-scene",
    description: "Everything at once: shared meshes, unique materials, multi-primitive meshes, textures and a tree in one frame. The headline number for a large frame.",
    run: async (ctx) => {
        const rig = await newRig(ctx);
        const parts: Array<[string, Build, number]> = [
            ["shared mesh", sharedMesh, scaled(8000)],
            ["unique materials", uniqueMaterials, scaled(2000)],
            ["unique geometries", uniqueGeometries, scaled(1000)],
            ["multi-primitive", multiPrimitive, scaled(500)],
            ["unique textures", uniqueTextures, scaled(500)],
        ];

        const roots: NodeWrapper[] = [];
        let draws = 0;
        let nodes = 0;
        const start = performance.now();
        let region = 0;
        for (const [, build, count] of parts) {
            // every part gets its own band of the view so the parts do not draw on top of each other
            const group = build(rig, count);
            const band = makeNode(null, [0, region * 0.4, 0], 0.3);
            for (const node of group) band.addChild(node);
            roots.push(band);
            nodes += count;
            draws += count * (build === multiPrimitive ? PRIMITIVES_PER_MESH : 1);
            region++;
        }
        const treeMesh = makeMesh(new PrimitiveWrapper(makeMaterial({color: [1, 1, 1]}), makeGeometry()));
        const tree = buildTree(treeMesh, scaled(10));
        roots.push(tree.root);
        nodes += tree.all.length;
        draws += tree.all.length;
        ctx.perf(`${nodes} nodes: wrapper graph built in ${ms(performance.now() - start)}`);
        addAll(rig, roots);

        await timeFrames(ctx, rig, `${nodes} nodes, ${draws} draw calls`);
        noOrphans(ctx, rig, "mixed scene");
        await quietFrames(ctx, rig, "steady state", 5);
        await leakFree(ctx, rig, "massive-mixed-scene", teardown(rig, roots));
    },
};

export const stressScenarios: Scenario[] = [
    sceneScenario("massive-shared-mesh", "20k nodes drawing one shared mesh. Everything but the per-node matrix is created once.", 20000, sharedMesh, 1, (ctx, added) => {
        ctx.check(added.pipeline === 1, `${added.pipeline} pipelines for one shared material and geometry, expected 1`);
        ctx.check(added.shaderModule === 2, `${added.shaderModule} shader modules, expected 2 (vertex + fragment)`);
        ctx.check(added.pipelineLayout === 1, `${added.pipelineLayout} pipeline layouts, expected 1`);
        ctx.check(added.bindgroupLayout === 3, `${added.bindgroupLayout} bind group layouts, expected 3 (scene, material, node)`);
    }),
    sceneScenario("massive-unique-materials", "5k nodes, each with its own material and primitive. Shader code and pipeline stay shared: factor values never reach the pipeline.", 5000, uniqueMaterials, 1, (ctx, added) => {
        ctx.check(added.pipeline === 1, `${added.pipeline} pipelines for materials that differ only in factor values, expected 1`);
        ctx.check(added.shaderModule === 2, `${added.shaderModule} shader modules, expected 2`);
    }),
    sceneScenario("massive-unique-geometries", "3k nodes, each with its own geometry (different vertex counts, indexed and not). One pipeline serves them all.", 3000, uniqueGeometries, 1, (ctx, added) => {
        ctx.check(added.pipeline === 1, `${added.pipeline} pipelines for geometries that share a vertex layout, expected 1`);
    }, 2),
    sceneScenario("massive-multi-primitive", "2k nodes, each drawing a mesh of 8 primitives (16k draw calls).", 2000, multiPrimitive, PRIMITIVES_PER_MESH, (ctx, added) => {
        ctx.check(added.pipeline === 1, `${added.pipeline} pipelines for 8 materials that share a shape, expected 1`);
    }),
    sceneScenario("massive-unique-textures", "1.5k nodes, each with its own texture. One GPU texture and one bind group per material, one shared sampler.", 1500, uniqueTextures, 1, (ctx, added) => {
        ctx.check(added.sampler === 1, `${added.sampler} GPU samplers for identical sampler settings, expected 1`);
    }),
    sharedTexture,
    variantsScenario,
    hierarchyChain,
    hierarchyTree,
    hugeGeometry,
    churn,
    animated,
    mixed,
];
