import {MANAGER_NAMES, pixelAt, type Rig} from "./rig.ts";
import {gpuClean, NOTHING, newRig, sameResources, trigger} from "./checks.ts";
import type {Scenario, TestCtx} from "./util.ts";
import {bumpEpoch, getEpoch} from "../engine/hashing/utils/epoch.ts";
import {ChangeStamp} from "../engine/hashing/utils/ChangeStamp.ts";
import {VersionFlag} from "../engine/hashing/utils/VersionFlag.ts";
import {HashHandler} from "../engine/hashing/utils/HashHandler.ts";
import {AggregateHashHandler} from "../engine/hashing/utils/AggregateHashHandler.ts";
import {stableKey} from "../engine/hashing/utils/stableKey.ts";
import {Hasher} from "../engine/hashing/utils/Hasher.ts";
import {RepresentationHashProvider} from "../engine/hashing/RepresentationHashProvider.ts";
import {flushPreFrame, hasPendingPreFrame, schedulePreFrame} from "../engine/Adaptors/PreFrameQueue.ts";
import {Source} from "../engine/Adaptors/Source.ts";
import {takeQueuedBuffers, takeQueuedImages} from "../engine/internals/UploadQueue.ts";
import {BufferInternal} from "../engine/internals/BufferInternal.ts";
import {AttributeInternal} from "../engine/internals/AttributeInternal.ts";
import {GeometryInternal} from "../engine/internals/GeometryInternal.ts";
import {MaterialInternal} from "../engine/internals/MaterialInternal.ts";
import {MeshInternal} from "../engine/internals/MeshInternal.ts";
import {NodeInternal} from "../engine/internals/NodeInternal.ts";
import {PrimitiveInternal} from "../engine/internals/PrimitiveInternal.ts";
import {ShaderStageRepresentation} from "../engine/Representations/ShaderStageRepresentation.ts";
import {BindgroupInteractor} from "../engine/Representations/BindgroupInteractor.ts";
import {PipelineInteractor} from "../engine/Representations/PipelineInteractor.ts";
import {PipelineLayoutRepresentation} from "../engine/Representations/PipelineLayoutRepresentation.ts";
import {BindgroupLayoutRepresentation} from "../engine/Representations/BindgroupLayoutRepresentation.ts";
import {ImageWrapper} from "../engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "../engine/wrappers/SamplerWrapper.ts";
import {CentralManager} from "../engine/managers/CentralManager.ts";
import {CentralProducer} from "../engine/producers/CentralProducer.ts";
import {pixelBytes} from "./scenes.ts";
import {SceneInternal} from "../engine/internals/SceneInternal.ts";

/**
 * Low-level change-trigger tests: the engine's core without a single wrapper or adapter.
 *
 *  low-level-machinery        epoch, change stamps, version flags, the pre-frame queue, sources, the upload queue
 *  low-level-hash-providers   when a hash is recomputed, what it depends on, and which setters move a stamp
 *  low-level-managers         ensure / acquire / release / collect, uploads
 *  low-level-raw-scene        a scene built by hand from internals with hand-written WGSL: what every internal setter
 *                             costs and, by reading the frame back, whether the change really reached the screen
 *
 * The last one is the point of the redesign: the core must work, and detect every change, with a shader and a layout
 * the built-in assemblers never produced.
 */

function expectEqual<T>(ctx: TestCtx, label: string, actual: T, expected: T): boolean {
    return ctx.check(actual === expected, `${label}: got ${String(actual)}, expected ${String(expected)}`);
}

// -- machinery ------------------------------------------------------------------------------------------------------

const machinery: Scenario = {
    name: "low-level-machinery",
    description: "Epoch, ChangeStamp, VersionFlag, PreFrameQueue (dedupe, rescheduling, error handling), Source and the upload queue behave as documented.",
    run: async (ctx) => {
        const rig = await newRig(ctx);
        flushPreFrame(rig.context); // leave nothing queued by earlier scenarios

        // epoch + stamps
        const e0 = getEpoch();
        const a = new ChangeStamp();
        const b = new ChangeStamp();
        a.mark();
        b.mark();
        ctx.check(getEpoch() === e0 + 2, `two marks moved the epoch by ${getEpoch() - e0}, expected 2`);
        ctx.check(b.get() > a.get() && a.get() > e0, "a stamp is the epoch at the moment it was marked: later marks must be larger");
        ctx.check(bumpEpoch() === getEpoch(), "bumpEpoch returns the new epoch");
        const stamped = a.get();
        b.mark();
        expectEqual(ctx, "marking one stamp leaves the other alone", a.get(), stamped);
        expectEqual(ctx, "a stamp that was never marked is 0", new ChangeStamp().get(), 0);

        // version flags
        const fresh = new VersionFlag();
        ctx.check(fresh.needsUpdate(), "VersionFlag() needs an update at first (nothing was ever synced)");
        fresh.sync();
        ctx.check(!fresh.needsUpdate(), "VersionFlag is clean after sync()");
        fresh.addVersion();
        fresh.addVersion();
        ctx.check(fresh.needsUpdate(), "VersionFlag is dirty after addVersion()");
        fresh.sync();
        ctx.check(!fresh.needsUpdate(), "VersionFlag is clean after sync(), however many versions were added");
        ctx.check(!new VersionFlag(false).needsUpdate(), "VersionFlag(false) starts clean");

        // pre-frame queue
        const runs = {a: 0, b: 0, chain: 0};
        const taskA = () => {
            runs.a++;
        };
        schedulePreFrame(taskA);
        schedulePreFrame(taskA);
        schedulePreFrame(taskA);
        ctx.check(hasPendingPreFrame(), "a scheduled task is pending");
        flushPreFrame(rig.context);
        expectEqual(ctx, "one task scheduled three times runs once", runs.a, 1);
        ctx.check(!hasPendingPreFrame(), "nothing is pending after a flush");

        const chained = () => {
            runs.chain++;
        };
        schedulePreFrame(() => schedulePreFrame(chained));
        flushPreFrame(rig.context);
        expectEqual(ctx, "a task scheduled by a task runs in the same flush", runs.chain, 1);

        let stop = false;
        const ping = (): void => {
            if (!stop) schedulePreFrame(pong);
        };
        const pong = (): void => {
            if (!stop) schedulePreFrame(ping);
        };
        schedulePreFrame(ping);
        let threw = "";
        try {
            flushPreFrame(rig.context);
        } catch (e) {
            threw = e instanceof Error ? e.message : String(e);
        }
        ctx.check(threw.includes("keep rescheduling"), `tasks that reschedule each other forever must be stopped with an error, got "${threw}"`);
        stop = true;
        flushPreFrame(rig.context);
        ctx.check(!hasPendingPreFrame(), "the queue can be drained again after the runaway was stopped");

        const failing = () => {
            throw new Error("first");
        };
        const survivor = () => {
            runs.b++;
        };
        schedulePreFrame(failing);
        schedulePreFrame(survivor);
        let rethrown = "";
        try {
            flushPreFrame(rig.context);
        } catch (e) {
            rethrown = e instanceof Error ? e.message : String(e);
        }
        expectEqual(ctx, "a throwing task does not stop the others", runs.b, 1);
        expectEqual(ctx, "the first error is rethrown after the flush", rethrown, "first");

        // sources
        const source = new Source<number>();
        const seen: string[] = [];
        source.subscribe("k", (v) => seen.push(`old${v}`));
        source.subscribe("k", (v) => seen.push(`new${v}`));
        expectEqual(ctx, "subscribing twice with one key keeps one subscriber", source.size, 1);
        source.notify(5);
        expectEqual(ctx, "the later subscription replaces the earlier one", seen.join(","), "new5");
        const order: string[] = [];
        source.subscribe("first", () => {
            order.push("first");
            source.unsubscribe("second");
        });
        source.subscribe("second", () => order.push("second"));
        source.notify(0);
        ctx.check(order.includes("second"), "a subscriber removed during notify() still gets this notification (notify iterates a copy)");
        source.notify(0);
        ctx.check(order.filter((o) => o === "second").length === 1, "...and none after that");
        source.unsubscribe("first");
        source.unsubscribe("k");
        expectEqual(ctx, "unsubscribing everyone empties the source", source.size, 0);

        // upload queue: data changes in place queue an upload and never stamp
        takeQueuedBuffers();
        takeQueuedImages();
        const buffer = new BufferInternal(new Float32Array(4).buffer, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        const epoch = getEpoch();
        buffer.setData(new Float32Array([1, 2, 3, 4]).buffer);
        buffer.setData(new Float32Array([5, 6, 7, 8]).buffer);
        buffer.markDirty();
        expectEqual(ctx, "BufferInternal.setData does not move the epoch", getEpoch(), epoch);
        const queued = takeQueuedBuffers();
        ctx.check(queued.length === 1 && queued[0] === buffer, `a buffer changed three times is queued once (queued ${queued.length})`);
        expectEqual(ctx, "the queue is empty after it was taken", takeQueuedBuffers().length, 0);
        ctx.check(buffer.hashProvider.needsUpdate(), "a changed buffer needs an update until the renderer syncs it");
        buffer.hashProvider.syncNeedsUpdate();
        ctx.check(!buffer.hashProvider.needsUpdate(), "...and not after");

        const image = new ImageWrapper(pixelBytes(2, [1, 2, 3, 4]), 2, 2);
        image.setData(pixelBytes(2, [9, 9, 9, 9]));
        image.setData(pixelBytes(2, [8, 8, 8, 8]));
        expectEqual(ctx, "an image changed twice is queued once", takeQueuedImages().length, 1);

        // hash handlers
        const hasher = await countingHasher();
        let keyBuilds = 0;
        const handler = new HashHandler(() => {
            keyBuilds++;
            return "k";
        });
        handler.convertToHash(hasher.hasher);
        handler.convertToHash(hasher.hasher);
        expectEqual(ctx, "HashHandler builds its key once while nothing changed", keyBuilds, 1);
        handler.addVersion();
        handler.addVersion();
        handler.convertToHash(hasher.hasher);
        expectEqual(ctx, "HashHandler rebuilds once after any number of addVersion()", keyBuilds, 2);

        let aggregateKey = "a";
        const aggregate = new AggregateHashHandler(() => aggregateKey);
        const before = hasher.calls();
        aggregate.convertToHash(hasher.hasher);
        aggregate.convertToHash(hasher.hasher);
        expectEqual(ctx, "AggregateHashHandler hashes once for an unchanged key", hasher.calls() - before, 1);
        aggregateKey = "b";
        aggregate.convertToHash(hasher.hasher);
        expectEqual(ctx, "...and again when the key changed", hasher.calls() - before, 2);

        expectEqual(ctx, "stableKey ignores object key order", stableKey({a: 1, b: {c: 2, d: 3}}), stableKey({b: {d: 3, c: 2}, a: 1}));
        ctx.check(stableKey([1, 2]) !== stableKey([2, 1]), "stableKey keeps array order");
        ctx.check(stableKey({a: undefined, b: 1}) === stableKey({b: 1}), "stableKey drops undefined");
        gpuClean(ctx, rig, "machinery");
    },
};

/** A real Hasher that counts how often it is asked to hash. */
async function countingHasher(): Promise<{ hasher: Hasher; calls: () => number }> {
    const real = await Hasher.create();
    let calls = 0;
    const hasher = {
        hashString: (s: string) => {
            calls++;
            return real.hashString(s);
        },
        hashArrayBuffer: (b: ArrayBuffer) => {
            calls++;
            return real.hashArrayBuffer(b);
        },
    } as unknown as Hasher;
    return {hasher, calls: () => calls};
}

// -- hash providers ---------------------------------------------------------------------------------------------------

const FRAME = {colorFormat: "bgra8unorm" as GPUTextureFormat, depthFormat: "depth32float" as GPUTextureFormat};
const VERTEX_LAYOUT: GPUVertexBufferLayout = {arrayStride: 12, attributes: [{shaderLocation: 0, offset: 0, format: "float32x3"}]};
const UNIFORM = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;

function uniformBuffer(): BufferInternal {
    return new BufferInternal(new Float32Array(4).buffer, UNIFORM);
}

function stage(code: string, entryPoint = "main"): ShaderStageRepresentation {
    const s = new ShaderStageRepresentation();
    s.setCode(code);
    s.setEntryPoint(entryPoint);
    return s;
}

function bindgroup(visibility = GPUShaderStage.FRAGMENT): BindgroupInteractor {
    const b = new BindgroupInteractor();
    b.setUniform(0, uniformBuffer(), visibility);
    return b;
}

function fullPipeline(): PipelineInteractor {
    const p = new PipelineInteractor();
    p.setVertex(stage("fn v() {}"));
    p.setFragment(stage("fn f() {}"));
    p.setVertexBuffers([VERTEX_LAYOUT]);
    p.setPrimitiveState({topology: "triangle-list", cullMode: "back"});
    p.setMaterialState({blend: undefined, depthWriteEnabled: true});
    p.setFrame(FRAME);
    p.setBindgroup(0, bindgroup());
    p.setBindgroup(1, bindgroup());
    return p;
}

const hashProviders: Scenario = {
    name: "low-level-hash-providers",
    description: "RepresentationHashProvider recomputes only when a stamp is newer (one hash for any number of sets); every pipeline input changes the pipeline hash; setters that change nothing stamp nothing; a change deep in the tree moves every ancestor's stamp, but data-only changes move none.",
    run: async (ctx) => {
        const {hasher, calls} = await countingHasher();

        // RepresentationHashProvider on its own
        let builds = 0;
        let key = "one";
        const child = new ChangeStamp();
        const provider = new RepresentationHashProvider({
            buildKey: () => {
                builds++;
                return key;
            },
            getChildrenChangedAt: () => child.get(),
        });
        const first = provider.convertToHash(hasher);
        provider.convertToHash(hasher);
        expectEqual(ctx, "an unchanged provider builds its key once for two reads", builds, 1);
        provider.markChanged();
        provider.markChanged();
        provider.markChanged();
        provider.convertToHash(hasher);
        expectEqual(ctx, "three markChanged() then one read cost one build", builds, 2);
        expectEqual(ctx, "a rebuild from the same key gives the same hash", provider.convertToHash(hasher), first);
        child.mark();
        provider.convertToHash(hasher);
        expectEqual(ctx, "a child stamped after the last build forces a rebuild", builds, 3);
        provider.convertToHash(hasher);
        expectEqual(ctx, "...and only one", builds, 3);
        key = "two";
        provider.markChanged();
        ctx.check(provider.convertToHash(hasher) !== first, "a different key gives a different hash");
        const stampBefore = provider.getChangedAt();
        child.mark();
        ctx.check(provider.getChangedAt() > stampBefore, "getChangedAt() includes the children");

        // shader stages: identity is the code, not the entry point
        const s1 = stage("code A");
        const s2 = stage("code A", "other");
        const s3 = stage("code B");
        expectEqual(ctx, "two stages with the same code share a module hash, entry point or not", s1.hashProvider.convertToHash(hasher), s2.hashProvider.convertToHash(hasher));
        ctx.check(s1.hashProvider.convertToHash(hasher) !== s3.hashProvider.convertToHash(hasher), "different code, different hash");
        let epoch = getEpoch();
        s1.setEntryPoint("renamed");
        ctx.check(getEpoch() > epoch, "setEntryPoint stamps the stage (the pipeline hash contains it)");
        expectEqual(ctx, "...but the module hash does not move", s1.hashProvider.convertToHash(hasher), s2.hashProvider.convertToHash(hasher));

        // bind groups and layouts
        const a = bindgroup();
        const b = bindgroup();
        expectEqual(ctx, "two bind groups with the same structure share a layout hash", a.layout.hashProvider.convertToHash(hasher), b.layout.hashProvider.convertToHash(hasher));
        ctx.check(a.hashProvider.convertToHash(hasher) !== b.hashProvider.convertToHash(hasher), "...but different buffers make different bind groups");
        const layoutHash = a.layout.hashProvider.convertToHash(hasher);
        const groupHash = a.hashProvider.convertToHash(hasher);
        a.setUniform(0, uniformBuffer(), GPUShaderStage.FRAGMENT);
        expectEqual(ctx, "rebinding another buffer keeps the layout hash", a.layout.hashProvider.convertToHash(hasher), layoutHash);
        ctx.check(a.hashProvider.convertToHash(hasher) !== groupHash, "...and changes the bind group hash");
        a.setUniform(0, uniformBuffer(), GPUShaderStage.VERTEX);
        ctx.check(a.layout.hashProvider.convertToHash(hasher) !== layoutHash, "stage visibility is part of the layout hash");

        const withTexture = new BindgroupInteractor();
        const image = new ImageWrapper(pixelBytes(2, [1, 1, 1, 1]), 2, 2);
        withTexture.setTexture(0, image, GPUShaderStage.FRAGMENT);
        const textureLayout = withTexture.layout.hashProvider.convertToHash(hasher);
        const textureGroup = withTexture.hashProvider.convertToHash(hasher);
        image.setFormat("rgba8unorm-srgb");
        ctx.check(withTexture.layout.hashProvider.convertToHash(hasher) !== textureLayout, "a texture's format is part of the layout hash");
        ctx.check(withTexture.hashProvider.convertToHash(hasher) !== textureGroup, "...and of the bind group hash");
        const sampled = new BindgroupInteractor();
        const sampler = new SamplerWrapper();
        sampled.setSampler(0, sampler, GPUShaderStage.FRAGMENT);
        const samplerGroup = sampled.hashProvider.convertToHash(hasher);
        sampler.setMagFilter("nearest");
        ctx.check(sampled.hashProvider.convertToHash(hasher) !== samplerGroup, "a sampler setting is part of the bind group hash");
        const otherSampled = new BindgroupInteractor();
        otherSampled.setSampler(0, new SamplerWrapper("nearest", "nearest", "nearest", "clamp-to-edge", "clamp-to-edge"), GPUShaderStage.FRAGMENT);
        expectEqual(ctx, "...and not of its layout (every sampler binds the same way)", sampled.layout.hashProvider.convertToHash(hasher), otherSampled.layout.hashProvider.convertToHash(hasher));

        const removable = bindgroup();
        const removableHash = removable.hashProvider.convertToHash(hasher);
        removable.removeBinding(0);
        ctx.check(removable.hashProvider.convertToHash(hasher) !== removableHash, "removing a binding changes the bind group hash");
        expectEqual(ctx, "...and leaves the layout empty", Array.from(removable.layout.getEntries()).length, 0);

        // pipeline layouts: the order the groups were set in does not matter
        const l0 = new BindgroupLayoutRepresentation();
        const l2 = new BindgroupLayoutRepresentation();
        l0.setEntry(0, {binding: 0, visibility: GPUShaderStage.VERTEX, buffer: uniformBuffer()});
        l2.setEntry(0, {binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: uniformBuffer()});
        const forward = new PipelineLayoutRepresentation();
        const backward = new PipelineLayoutRepresentation();
        forward.setLayout(0, l0);
        forward.setLayout(2, l2);
        backward.setLayout(2, l2);
        backward.setLayout(0, l0);
        expectEqual(ctx, "a pipeline layout hash does not depend on the order groups were set", forward.hashProvider.convertToHash(hasher), backward.hashProvider.convertToHash(hasher));

        // pipelines: every input changes the hash, exactly one hash is computed per change, no-ops stamp nothing
        const pipeline = fullPipeline();
        const hashOf = () => pipeline.hashProvider.convertToHash(hasher);
        let last = hashOf();
        const changes: Array<[string, () => void]> = [
            ["vertex code", () => pipeline.setVertex(stage("fn v2() {}"))],
            ["fragment entry point", () => pipeline.setFragment(stage("fn f() {}", "entry2"))],
            ["vertex buffer layout", () => pipeline.setVertexBuffers([{...VERTEX_LAYOUT, arrayStride: 16}])],
            ["primitive state (cull mode)", () => pipeline.setPrimitiveState({topology: "triangle-list", cullMode: "front"})],
            ["primitive state (topology)", () => pipeline.setPrimitiveState({topology: "line-list", cullMode: "front"})],
            ["material state (blend)", () => pipeline.setMaterialState({blend: {color: {srcFactor: "one", dstFactor: "zero"}, alpha: {srcFactor: "one", dstFactor: "zero"}}, depthWriteEnabled: false})],
            ["material state (depth write)", () => pipeline.setMaterialState({blend: undefined, depthWriteEnabled: true})],
            ["frame colour format", () => pipeline.setFrame({...FRAME, colorFormat: "rgba8unorm"})],
            ["frame depth format", () => pipeline.setFrame({colorFormat: "rgba8unorm", depthFormat: "depth24plus"})],
            ["a bind group of another structure", () => pipeline.setBindgroup(1, bindgroup(GPUShaderStage.VERTEX))],
            ["an extra bind group", () => pipeline.setBindgroup(2, bindgroup())],
            ["a removed bind group", () => pipeline.removeBindgroup(2)],
        ];
        for (const [label, change] of changes) {
            const callsBefore = calls();
            change();
            const next = hashOf();
            ctx.check(next !== last, `changing the pipeline's ${label} did not change its hash`);
            ctx.check(calls() - callsBefore >= 1, `changing the pipeline's ${label} computed no hash`);
            last = next;
        }

        epoch = getEpoch();
        const callsBefore = calls();
        pipeline.setFrame({colorFormat: "rgba8unorm", depthFormat: "depth24plus"});
        pipeline.setMaterialState({blend: undefined, depthWriteEnabled: true});
        expectEqual(ctx, "setFrame / setMaterialState with the values they already have stamp nothing", getEpoch(), epoch);
        expectEqual(ctx, "...and the pipeline hash stays put", hashOf(), last);
        expectEqual(ctx, "...without computing anything", calls(), callsBefore);

        // internals: no-op setters stamp nothing, real ones do
        const node = new NodeInternal(2, 0);
        const mesh = new MeshInternal();
        node.setMesh(mesh);
        epoch = getEpoch();
        node.setMesh(mesh);
        node.setFrame(FRAME);
        const afterFrame = getEpoch();
        node.setFrame({...FRAME});
        expectEqual(ctx, "NodeInternal.setMesh(same mesh) stamps nothing", afterFrame - epoch, 1); // only the first setFrame stamped
        expectEqual(ctx, "NodeInternal.setFrame(equal frame) stamps nothing", getEpoch(), afterFrame);
        node.removePipelines("nothing here");
        expectEqual(ctx, "NodeInternal.removePipelines(unknown primitive) stamps nothing", getEpoch(), afterFrame);
        node.setPipelines("p", [fullPipeline()]);
        ctx.check(getEpoch() > afterFrame, "NodeInternal.setPipelines stamps the node");
        const geometry = new GeometryInternal();
        epoch = getEpoch();
        geometry.removeVertexAttribute(3);
        expectEqual(ctx, "GeometryInternal.removeVertexAttribute(unknown slot) stamps nothing", getEpoch(), epoch);
        geometry.setDrawInfo({vertexCount: 3});
        ctx.check(getEpoch() > epoch, "GeometryInternal.setDrawInfo stamps");

        // propagation: node -> mesh -> primitive -> material -> bind group -> image / sampler / buffer
        const material = new MaterialInternal(1);
        const matGroup = material.getBindgroupInteractor();
        const matImage = new ImageWrapper(pixelBytes(2, [5, 5, 5, 5]), 2, 2);
        const matSampler = new SamplerWrapper();
        const matBuffer = uniformBuffer();
        matGroup.setUniform(0, matBuffer, GPUShaderStage.FRAGMENT);
        matGroup.setTexture(1, matImage, GPUShaderStage.FRAGMENT);
        matGroup.setSampler(2, matSampler, GPUShaderStage.FRAGMENT);
        const primitive = new PrimitiveInternal();
        primitive.setMat(material);
        primitive.setGeo(geometry);
        primitive.vertex.setCode("v");
        primitive.fragment.setCode("f");
        mesh.setPrimitive(primitive);

        const at = () => node.hashProvider.getChangedAt();
        const hashNode = () => node.hashProvider.convertToHash(hasher);
        let nodeHash = hashNode();
        let nodeAt = at();

        const moves: Array<[string, () => void, boolean]> = [
            ["a shader stage's code", () => primitive.fragment.setCode("f2"), true],
            ["a sampler setting", () => matSampler.setMinFilter("nearest"), true],
            ["an image's size", () => {
                matImage.setData(pixelBytes(4, [0, 0, 0, 0]));
                matImage.setDimensions(4, 4);
            }, true],
            ["the geometry's draw info", () => geometry.setDrawInfo({vertexCount: 6}), true],
            ["a vertex attribute", () => geometry.setVertexAttribute(0, new AttributeInternal(new Float32Array(9).buffer, VERTEX_LAYOUT)), true],
            ["a binding of the material", () => matGroup.setUniform(0, uniformBuffer(), GPUShaderStage.FRAGMENT), true],
        ];
        for (const [label, change, shouldChangeHash] of moves) {
            change();
            ctx.check(at() > nodeAt, `changing ${label} did not reach the node's change stamp, so its render items would never be rebuilt`);
            const next = hashNode();
            if (shouldChangeHash) ctx.check(next !== nodeHash, `changing ${label} did not change the node's hash`);
            nodeAt = at();
            nodeHash = next;
        }

        // data only: pixels and buffer contents are uploaded, never hashed
        matImage.setData(pixelBytes(4, [3, 3, 3, 3]));
        const stampAfterImage = at();
        ctx.check(stampAfterImage > nodeAt, "new pixels stamp the image (the engine re-checks the node, finds the same hash, and keeps its items)");
        expectEqual(ctx, "new pixels leave the node's hash alone", hashNode(), nodeHash);
        nodeAt = stampAfterImage;
        const e = getEpoch();
        matBuffer.setData(new Float32Array([9, 9, 9, 9]).buffer);
        expectEqual(ctx, "new buffer contents move neither the epoch nor the node's stamp", getEpoch() === e && at() === nodeAt, true);
        takeQueuedBuffers();
        takeQueuedImages();
    },
};

// -- managers --------------------------------------------------------------------------------------------------------

const managers: Scenario = {
    name: "low-level-managers",
    description: "ResourceManager: ensure builds once per key, acquire/release counts refs, unreferenced resources are collected at the end of the frame, a resource that is acquired again before that survives, uploads write in place and reject sizes that do not fit.",
    run: async (ctx) => {
        const rig = await newRig(ctx);
        const central = new CentralManager(rig.device);
        const producer = new CentralProducer();
        const buffers = central.bufferManager;

        const one = uniformBuffer();
        let descriptors = 0;
        const describe = (b: BufferInternal) => () => {
            descriptors++;
            return producer.produceBuffer(b);
        };

        buffers.ensure("k1", describe(one));
        buffers.ensure("k1", describe(one));
        expectEqual(ctx, "ensure() on an existing key does not ask for a descriptor", descriptors, 1);
        expectEqual(ctx, "the manager holds one resource", buffers.getCacheLength(), 1);
        ctx.check(buffers.has("k1") && !buffers.has("k2"), "has() tells which keys exist");

        let message = "";
        try {
            buffers.acquire("missing");
        } catch (e) {
            message = e instanceof Error ? e.message : String(e);
        }
        ctx.check(message.includes("missing"), "acquire() of a key that was never ensured throws and names the key");
        message = "";
        try {
            buffers.release("k1");
        } catch (e) {
            message = e instanceof Error ? e.message : String(e);
        }
        ctx.check(message.includes("below 0"), `release() without a matching acquire() throws (got "${message}")`);

        buffers.acquire("k1");
        buffers.acquire("k1");
        buffers.release("k1");
        central.endFrame();
        ctx.check(buffers.has("k1"), "a resource that is still referenced survives the end of the frame");
        buffers.release("k1");
        central.endFrame();
        ctx.check(!buffers.has("k1"), "a resource nobody references is collected at the end of the frame");

        buffers.ensure("k2", describe(one));
        buffers.acquire("k2");
        buffers.release("k2");
        buffers.acquire("k2");
        central.endFrame();
        ctx.check(buffers.has("k2"), "a resource released and acquired again within the frame is not collected");
        buffers.release("k2");
        central.endFrame();
        ctx.check(!buffers.has("k2"), "...and is collected when it is really unused");

        // uploads
        const target = uniformBuffer();
        buffers.ensure("up", () => producer.produceBuffer(target));
        buffers.acquire("up");
        buffers.upload("up", new Float32Array([1, 2, 3, 4]));
        buffers.upload("up", new Float32Array([5]), 12);
        let overflow = "";
        try {
            buffers.upload("up", new Float32Array(5));
        } catch (e) {
            overflow = e instanceof Error ? e.message : String(e);
        }
        ctx.check(overflow.includes("overflows"), `an upload that does not fit throws (got "${overflow}")`);
        overflow = "";
        try {
            buffers.upload("up", new Float32Array(1), 16);
        } catch (e) {
            overflow = e instanceof Error ? e.message : String(e);
        }
        ctx.check(overflow.includes("overflows"), "an upload that starts past the end throws");
        let missing = "";
        try {
            buffers.upload("nope", new Float32Array(1));
        } catch (e) {
            missing = e instanceof Error ? e.message : String(e);
        }
        ctx.check(missing.includes("no buffer"), `an upload to a key that does not exist throws (got "${missing}")`);

        const textures = central.textureManager;
        let textureMissing = "";
        try {
            textures.upload("nope", {data: new ArrayBuffer(16), bytesPerRow: 8, width: 2, height: 2});
        } catch (e) {
            textureMissing = e instanceof Error ? e.message : String(e);
        }
        ctx.check(textureMissing.includes("not found"), `a texture upload to a missing key throws (got "${textureMissing}")`);

        // every manager shares the same rules
        for (const name of MANAGER_NAMES) {
            const manager = central[`${name}Manager` as keyof CentralManager] as unknown as { getCacheLength(): number };
            expectEqual(ctx, `a new ${name} manager starts empty`, manager.getCacheLength(), name === "buffer" ? 1 : 0);
        }
        await rig.render(1);
        gpuClean(ctx, rig, "managers");
    },
};

// -- the raw scene ----------------------------------------------------------------------------------------------------

const VERTEX_CODE = `
struct Camera { view: mat4x4f, projection: mat4x4f };
struct Node { world: mat4x4f };
@group(0) @binding(0) var<uniform> camera: Camera;
@group(2) @binding(0) var<uniform> node: Node;
struct Out { @builtin(position) position: vec4f };
@vertex fn main(@location(0) position: vec3f) -> Out {
    var out: Out;
    out.position = camera.projection * camera.view * node.world * vec4f(position, 1.0);
    return out;
}`;

/** `main` returns the material colour times `tint`; `alt` is a second entry point of the same module that returns blue. */
function fragmentCode(tint = "vec4f(1.0)"): string {
    return `
struct Material { color: vec4f };
@group(1) @binding(0) var<uniform> material: Material;
@fragment fn main() -> @location(0) vec4f { return material.color * ${tint}; }
@fragment fn alt() -> @location(0) vec4f { return vec4f(0.0, 0.0, 1.0, 1.0); }`;
}

const TRIANGLE = new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]);
const TRIANGLE_FAR_RIGHT = new Float32Array([5, -1, 0, 7, -1, 0, 6, 1, 0]);
const BLEND: GPUBlendState = {
    color: {srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add"},
    alpha: {srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add"},
};

function translation(x: number): ArrayBuffer {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    m[12] = x;
    return m.buffer as ArrayBuffer;
}

const vertexAttribute = (data: Float32Array) =>
    new AttributeInternal(data.buffer as ArrayBuffer, {arrayStride: 12, stepMode: "vertex", attributes: [{shaderLocation: 0, offset: 0, format: "float32x3"}]});

/** One drawable thing built from internals only. Several can share the primitive. */
interface RawNode {
    node: NodeInternal;
    pipeline: PipelineInteractor;
    matrix: BufferInternal;
}

function rawNode(rig: Rig, primitive: PrimitiveInternal, mesh: MeshInternal, x = 0): RawNode {
    const ctx = rig.context;
    const node = new NodeInternal(2, 0);
    const matrix = new BufferInternal(translation(x), UNIFORM);
    node.bindgroupInteractor.setUniform(0, matrix, GPUShaderStage.VERTEX);
    node.setMesh(mesh);

    const pipeline = new PipelineInteractor();
    const attribute = primitive.getGeo().getVertexAttributes().get(0)!;
    pipeline.setVertex(primitive.vertex);
    pipeline.setFragment(primitive.fragment);
    pipeline.setVertexBuffers([attribute.getLayout()!]);
    pipeline.setPrimitiveState({topology: "triangle-list", cullMode: "none"});
    pipeline.setMaterialState({blend: undefined, depthWriteEnabled: true});
    pipeline.setFrame(ctx.frame);
    pipeline.setBindgroup(0, ctx.sceneBindgroup);
    pipeline.setBindgroup(1, primitive.getMat().getBindgroupInteractor());
    pipeline.setBindgroup(2, node.bindgroupInteractor);
    node.setPipelines(primitive.uuid, [pipeline]);
    return {node, pipeline, matrix};
}

function expectColor(ctx: TestCtx, label: string, pixels: Uint8ClampedArray, x: number, y: number, rgb: [number, number, number]): void {
    const [r, g, b] = pixelAt(pixels, Math.round(x), Math.round(y));
    const ok = Math.abs(r - rgb[0]) <= 3 && Math.abs(g - rgb[1]) <= 3 && Math.abs(b - rgb[2]) <= 3;
    ctx.check(ok, `${label}: pixel (${Math.round(x)}, ${Math.round(y)}) is rgb(${r}, ${g}, ${b}), expected rgb(${rgb.join(", ")})`);
}

const rawScene: Scenario = {
    name: "low-level-raw-scene",
    description: "A scene built from internals with hand-written WGSL and no wrapper or adapter. Every internal setter is checked for what it costs and, by reading the frame back, for whether the change reached the screen.",
    run: async (ctx) => {
        const rig = await newRig(ctx);
        const [cx, cy] = rig.project(0, 0, 0);

        const geometry = new GeometryInternal();
        const attribute = vertexAttribute(TRIANGLE);
        geometry.setVertexAttribute(0, attribute);
        geometry.setDrawInfo({vertexCount: 3});

        const material = new MaterialInternal(1);
        const color = new BufferInternal(new Float32Array([1, 0, 0, 1]).buffer, UNIFORM);
        material.getBindgroupInteractor().setUniform(0, color, GPUShaderStage.FRAGMENT);

        const primitive = new PrimitiveInternal();
        primitive.setMat(material);
        primitive.setGeo(geometry);
        primitive.vertex.setCode(VERTEX_CODE);
        primitive.fragment.setCode(fragmentCode());

        const mesh = new MeshInternal();
        mesh.setPrimitive(primitive);
        const raw = rawNode(rig, primitive, mesh);
        const scene = new SceneInternal();

        // The raw test uses SceneInternal directly: no wrapper or adapter may rewrite its node list.
        const first = await rig.step(() => {
            scene.setNodes([raw.node]);
            rig.custom = scene;
        });
        gpuClean(ctx, rig, "first frame");
        const created = first.created;
        ctx.check(created.buffer === 3 && created.shaderModule === 2 && created.bindgroupLayout === 3
                && created.pipelineLayout === 1 && created.bindgroup === 3 && created.pipeline === 1 && created.texture === 0,
            `the first frame created ${JSON.stringify(created)}, expected 3 buffers, 2 shader modules, 3 bind group layouts, 1 pipeline layout, 3 bind groups and 1 pipeline`);
        let pixels = await rig.readPixels();
        expectColor(ctx, "first frame", pixels, cx, cy, [255, 0, 0]);
        ctx.check(pixelAt(pixels, 10, 10)[0] === 0, "the clear colour is black outside the triangle");

        const idle = {created: NOTHING, hashing: "none", epoch: "still"} as const;

        // data: uploads, nothing else, and it has to arrive
        await trigger(ctx, rig, "uniform buffer setData (colour -> green)", () => color.setData(new Float32Array([0, 1, 0, 1]).buffer), {...idle, bufferWrites: 1});
        expectColor(ctx, "after the colour upload", await rig.readPixels(), cx, cy, [0, 255, 0]);

        await trigger(ctx, rig, "node matrix setData (move to x = 3)", () => raw.matrix.setData(translation(3)), {...idle, bufferWrites: 1});
        pixels = await rig.readPixels();
        expectColor(ctx, "the centre after the node moved away", pixels, cx, cy, [0, 0, 0]);
        const [mx, my] = rig.project(3, 0, 0);
        expectColor(ctx, "where the node moved to", pixels, mx, my, [0, 255, 0]);
        await trigger(ctx, rig, "node matrix setData (back)", () => raw.matrix.setData(translation(0)), {...idle, bufferWrites: 1});

        await trigger(ctx, rig, "attribute setData (triangle far to the right)", () => attribute.setData(TRIANGLE_FAR_RIGHT.buffer as ArrayBuffer), {...idle, bufferWrites: 1});
        expectColor(ctx, "the centre after the vertices moved away", await rig.readPixels(), cx, cy, [0, 0, 0]);
        await trigger(ctx, rig, "attribute setData (back)", () => attribute.setData(TRIANGLE.buffer as ArrayBuffer), {...idle, bufferWrites: 1});

        // shader stages
        await trigger(ctx, rig, "fragment stage setCode (new code)", () => primitive.fragment.setCode(fragmentCode("vec4f(0.5, 1.0, 1.0, 1.0)")), {
            created: {shaderModule: 1, pipeline: 1},
        }, {sameAfter: true});
        expectColor(ctx, "after the code changed", await rig.readPixels(), cx, cy, [0, 255, 0]);
        await trigger(ctx, rig, "colour upload together with setCode(unchanged code): no new module", () => {
            color.setData(new Float32Array([1, 1, 0, 1]).buffer);
            primitive.fragment.setCode(fragmentCode("vec4f(0.5, 1.0, 1.0, 1.0)"));
        }, {created: NOTHING, bufferWrites: 1});
        expectColor(ctx, "tinted colour", await rig.readPixels(), cx, cy, [128, 255, 0]);

        await trigger(ctx, rig, "fragment stage setEntryPoint('alt') (same module)", () => primitive.fragment.setEntryPoint("alt"), {
            created: {pipeline: 1},
        }, {sameAfter: true});
        expectColor(ctx, "after the entry point changed", await rig.readPixels(), cx, cy, [0, 0, 255]);
        await trigger(ctx, rig, "fragment stage setEntryPoint('main')", () => primitive.fragment.setEntryPoint("main"), {created: {pipeline: 1}}, {sameAfter: true});

        // pipeline state
        await trigger(ctx, rig, "pipeline.setPrimitiveState (cull front faces)", () => raw.pipeline.setPrimitiveState({topology: "triangle-list", cullMode: "front"}), {
            created: {pipeline: 1},
        }, {sameAfter: true});
        expectColor(ctx, "the triangle faces the camera, so culling front faces hides it", await rig.readPixels(), cx, cy, [0, 0, 0]);
        await trigger(ctx, rig, "pipeline.setPrimitiveState (cull back faces)", () => raw.pipeline.setPrimitiveState({topology: "triangle-list", cullMode: "back"}), {
            created: {pipeline: 1},
        }, {sameAfter: true});
        expectColor(ctx, "culling back faces keeps it", await rig.readPixels(), cx, cy, [128, 255, 0]);
        await trigger(ctx, rig, "pipeline.setPrimitiveState (cull none)", () => raw.pipeline.setPrimitiveState({topology: "triangle-list", cullMode: "none"}), {
            created: {pipeline: 1},
        }, {sameAfter: true});

        await trigger(ctx, rig, "pipeline.setMaterialState (blend, no depth write)", () => raw.pipeline.setMaterialState({blend: BLEND, depthWriteEnabled: false}), {
            created: {pipeline: 1},
        }, {sameAfter: true});
        await trigger(ctx, rig, "pipeline.setMaterialState (same values again)", () => raw.pipeline.setMaterialState({blend: BLEND, depthWriteEnabled: false}), {
            ...idle, bufferWrites: 0,
        });
        await trigger(ctx, rig, "pipeline.setMaterialState (opaque)", () => raw.pipeline.setMaterialState({blend: undefined, depthWriteEnabled: true}), {
            created: {pipeline: 1},
        }, {sameAfter: true});

        // geometry
        await trigger(ctx, rig, "geometry.setDrawInfo (0 vertices)", () => geometry.setDrawInfo({vertexCount: 0}), {created: NOTHING, bufferWrites: 0});
        expectColor(ctx, "nothing is drawn with 0 vertices", await rig.readPixels(), cx, cy, [0, 0, 0]);
        await trigger(ctx, rig, "geometry.setDrawInfo (3 vertices)", () => geometry.setDrawInfo({vertexCount: 3}), {created: NOTHING, bufferWrites: 0});
        expectColor(ctx, "the triangle is back", await rig.readPixels(), cx, cy, [128, 255, 0]);

        await trigger(ctx, rig, "geometry.setVertexAttribute (another buffer, same layout)", () => geometry.setVertexAttribute(0, vertexAttribute(TRIANGLE)), {
            created: {buffer: 1}, bufferWrites: 0,
        }, {sameAfter: true});
        expectColor(ctx, "drawn from the new buffer", await rig.readPixels(), cx, cy, [128, 255, 0]);

        // bind groups: another buffer is another bind group, never another layout
        await trigger(ctx, rig, "node bind group: another matrix buffer", () => {
            const replacement = new BufferInternal(translation(0), UNIFORM);
            raw.node.bindgroupInteractor.setUniform(0, replacement, GPUShaderStage.VERTEX);
            raw.matrix = replacement;
        }, {created: {buffer: 1, bindgroup: 1}}, {sameAfter: true});
        await trigger(ctx, rig, "material bind group: another colour buffer", () => {
            const replacement = new BufferInternal(new Float32Array([0, 0, 1, 1]).buffer, UNIFORM);
            material.getBindgroupInteractor().setUniform(0, replacement, GPUShaderStage.FRAGMENT);
        }, {created: {buffer: 1, bindgroup: 1}}, {sameAfter: true});
        expectColor(ctx, "drawn with the new colour buffer", await rig.readPixels(), cx, cy, [0, 0, 255]);

        // a second node over the same primitive: its matrix and bind group, nothing else
        const second = rawNode(rig, primitive, mesh, 2);
        await trigger(ctx, rig, "scene.setNodes (a second node over the same primitive)", () => scene.setNodes([raw.node, second.node]), {
            created: {buffer: 1, bindgroup: 1},
        });
        const [sx, sy] = rig.project(2, 0, 0);
        expectColor(ctx, "the second node is drawn", await rig.readPixels(), sx, sy, [0, 0, 255]);
        await trigger(ctx, rig, "scene.setNodes (the second node leaves)", () => scene.setNodes([raw.node]), {created: NOTHING}, {sameAfter: false});

        // the target format is the renderer's input: every node's pipeline follows
        const frameBefore = {...rig.frameInfo};
        await trigger(ctx, rig, "render target format changes", () => rig.swapColorTargetFormat(), {created: {pipeline: 1}});
        ctx.check(rig.frameInfo.colorFormat !== frameBefore.colorFormat, "the renderer did not notice the new colour format");
        await trigger(ctx, rig, "render target format restored", () => rig.restoreColorTarget(), {created: {pipeline: 1}});

        // membership
        const populated = rig.snapshot();
        await trigger(ctx, rig, "node.setMesh(null)", () => raw.node.setMesh(null), {});
        ctx.check(rig.addedSinceBaseline().pipeline === 0, `a node without a mesh keeps ${rig.addedSinceBaseline().pipeline} pipeline(s)`);
        await trigger(ctx, rig, "node.setMesh(mesh)", () => raw.node.setMesh(mesh), {});
        sameCount(ctx, rig, "mesh removed and set again", populated);

        await trigger(ctx, rig, "scene.setNodes([]) (everything leaves)", () => scene.setNodes([]), {});
        const left = rig.addedSinceBaseline();
        ctx.check(Object.values(left).every((n) => n === 0), `an empty scene still holds ${JSON.stringify(left)}`);
        await trigger(ctx, rig, "scene.setNodes([node]) (comes back)", () => scene.setNodes([raw.node]), {});
        sameResources(ctx, rig, "scene emptied and refilled", populated);
        expectColor(ctx, "drawn again", await rig.readPixels(), cx, cy, [0, 0, 255]);

        gpuClean(ctx, rig, "raw scene");
    },
};

function sameCount(ctx: TestCtx, rig: Rig, label: string, before: ReturnType<Rig["snapshot"]>): void {
    const now = rig.snapshot();
    const wrong = MANAGER_NAMES.filter((n) => now[n].keys.length !== before[n].keys.length)
        .map((n) => `${n} ${before[n].keys.length} -> ${now[n].keys.length}`);
    ctx.check(wrong.length === 0, `${label}: live resources differ from before (${wrong.join(", ")})`);
}

export const internalScenarios: Scenario[] = [machinery, hashProviders, managers, rawScene];
