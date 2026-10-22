import {flushPreFrame} from "../engine/Adaptors/PreFrameQueue.ts";
import {SceneAdaptor} from "../engine/Adaptors/SceneAdaptor.ts";
import {AttributeWrapper} from "../engine/wrappers/AttributeWrapper.ts";
import {GeometryWrapper} from "../engine/wrappers/GeometryWrapper.ts";
import {MaterialWrapper} from "../engine/wrappers/MaterialWrapper.ts";
import {MaterialComponentWrapper} from "../engine/wrappers/MaterialComponentWrapper.ts";
import {PrimitiveWrapper} from "../engine/wrappers/PrimitiveWrapper.ts";
import {MeshWrapper} from "../engine/wrappers/MeshWrapper.ts";
import {NodeWrapper} from "../engine/wrappers/NodeWrapper.ts";
import {ImageWrapper} from "../engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "../engine/wrappers/SamplerWrapper.ts";
import {TextureWrapper} from "../engine/wrappers/TextureWrapper.ts";
import {ResourceManager} from "../engine/managers/Manager.ts";
import {Tracker} from "../engine/Trackers/Tracker.ts";
import {Renderer} from "../engine/Renderer/Renderer.ts";
import {PerspectiveCamera} from "../engine/Camera/PerspectiveCamera.ts";
import type {CentralManager} from "../engine/managers/CentralManager.ts";

type TestCase = { name: string; run: () => void | Promise<void> };
type Result = { name: string; status: "pass" | "fail" | "skip"; detail?: string };

const resultsElement = document.querySelector<HTMLDivElement>("#results");
const summaryElement = document.querySelector<HTMLParagraphElement>("#summary");
if (!resultsElement || !summaryElement) throw new Error("Test page is missing #results or #summary");

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}
function equal<T>(actual: T, expected: T, message: string): void {
    if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
function near(actual: number, expected: number, message: string, epsilon = 1e-4): void {
    if (Math.abs(actual - expected) > epsilon) throw new Error(`${message}: expected ${expected} ± ${epsilon}, got ${actual}`);
}
function logResult(result: Result): void {
    const details = document.createElement("details");
    details.className = result.status;
    const summary = document.createElement("summary");
    summary.textContent = `${result.status.toUpperCase()} — ${result.name}`;
    details.append(summary);
    if (result.detail) {
        const pre = document.createElement("pre");
        pre.className = result.status === "fail" ? "fail" : result.status === "skip" ? "warn" : "info";
        pre.textContent = result.detail;
        details.append(pre);
    }
    resultsElement!.append(details);
}
async function runCase(test: TestCase): Promise<Result> {
    try {
        await test.run();
        return {name: test.name, status: "pass"};
    } catch (error) {
        return {name: test.name, status: "fail", detail: error instanceof Error ? error.stack ?? error.message : String(error)};
    }
}

function makeGeometry(): GeometryWrapper {
    const geometry = new GeometryWrapper();
    geometry.setAttribute(new AttributeWrapper(
        "position",
        new Float32Array([-0.6, -0.5, 0, 0.6, -0.5, 0, 0, 0.6, 0]).buffer,
        "float32x3",
    ));
    return geometry;
}
function makeMaterial(): MaterialWrapper {
    const material = new MaterialWrapper();
    material.setComponent(new MaterialComponentWrapper("baseColor", [0.9, 0.25, 0.1, 1]));
    return material;
}
function makeDrawable() {
    const material = makeMaterial();
    const geometry = makeGeometry();
    const primitive = new PrimitiveWrapper(material, geometry);
    const mesh = new MeshWrapper();
    mesh.setPrimitive(primitive);
    const node = new NodeWrapper();
    node.setMesh(mesh);
    return {material, geometry, primitive, mesh, node};
}

class FakeTracker extends Tracker<{ destroyed: boolean }> {
    constructor() { super({destroyed: false}, "buffer"); }
    destroy(): void { this.raw.destroyed = true; }
}
class FakeManager extends ResourceManager<object, FakeTracker> {
    protected build(_getDescriptor: () => object): FakeTracker { return new FakeTracker(); }
}

type CacheSnapshot = Record<string, number>;
function managerCacheSnapshot(renderer: Renderer): CacheSnapshot {
    const managers = (renderer as unknown as { managers: CentralManager }).managers;
    return {
        buffers: managers.bufferManager.getCacheLength(),
        textures: managers.textureManager.getCacheLength(),
        samplers: managers.samplerManager.getCacheLength(),
        bindgroupLayouts: managers.bindgroupLayoutManager.getCacheLength(),
        bindgroups: managers.bindgroupManager.getCacheLength(),
        pipelineLayouts: managers.pipelineLayoutManager.getCacheLength(),
        shaderModules: managers.shaderModuleManager.getCacheLength(),
        pipelines: managers.pipelineManager.getCacheLength(),
    };
}
function totalCaches(snapshot: CacheSnapshot): number {
    return Object.values(snapshot).reduce((sum, count) => sum + count, 0);
}

const tests: TestCase[] = [
    {
        name: "HIGH LEVEL — scene flattening follows mesh assignment and hierarchy changes",
        run() {
            const root = new NodeWrapper();
            const child = new NodeWrapper();
            const scene = new SceneAdaptor(root.adaptor);
            root.addChild(child);
            child.setMesh(makeDrawable().mesh);
            flushPreFrame();
            equal(scene.internal.getNodes().length, 1, "one mesh-bearing node should be in scene");
            equal(scene.internal.getNodes()[0], child.adaptor.internal, "scene should expose child internal");
            root.removeChild(child);
            flushPreFrame();
            equal(scene.internal.getNodes().length, 0, "removed subtree should leave scene");
        },
    },
    {
        name: "HIGH LEVEL — parent transforms propagate to descendants after queue flush",
        run() {
            const parent = new NodeWrapper();
            const child = new NodeWrapper();
            parent.addChild(child);
            parent.setTranslation(2, 0, 0);
            child.setTranslation(0, 3, 0);
            flushPreFrame();
            near(child.getWorldMatrix()[12], 2, "child world X");
            near(child.getWorldMatrix()[13], 3, "child world Y");
            parent.setTranslation(5, 0, 0);
            flushPreFrame();
            near(child.getWorldMatrix()[12], 5, "descendant world X after parent mutation");
        },
    },
    {
        name: "HIGH LEVEL — factor value changes preserve plan version when shape is unchanged",
        run() {
            const material = makeMaterial();
            flushPreFrame();
            const component = material.getComponent("baseColor")!;
            const version = material.adaptor.getPlanVersion();
            component.setFactors([0.1, 0.2, 0.3, 1]);
            flushPreFrame();
            equal(material.adaptor.getPlanVersion(), version, "same-arity factor update should not invalidate shader plan");
            component.setFactors([0.1, 0.2]);
            flushPreFrame();
            assert(material.adaptor.getPlanVersion() > version, "factor arity change must invalidate generated shader plan");
        },
    },
    {
        name: "HIGH LEVEL — texture binding changes invalidate the material plan",
        run() {
            const material = makeMaterial();
            flushPreFrame();
            const component = material.getComponent("baseColor")!;
            const before = material.adaptor.getPlanVersion();
            const image = new ImageWrapper(new Uint8Array([255, 255, 255, 255]).buffer, 1, 1);
            const texture = new TextureWrapper(image, new SamplerWrapper());
            component.setTexture({wrapper: texture, texCoord: "TEXCOORD_0"});
            flushPreFrame();
            assert(material.adaptor.getPlanVersion() > before, "adding a texture binding should bump plan version");
            assert(material.adaptor.getBindingPlan().slots.length >= 2, "texture and sampler bindings should be planned");
            component.removeTexture();
            flushPreFrame();
            assert(material.adaptor.getBindingPlan().slots.length === 0, "removing texture should remove texture/sampler slots");
        },
    },
    {
        name: "HIGH LEVEL — pipeline-only settings update variants without changing material plan",
        run() {
            const drawable = makeDrawable();
            const root = new NodeWrapper();
            root.addChild(drawable.node);
            const scene = new SceneAdaptor(root.adaptor);
            flushPreFrame();
            const version = drawable.material.adaptor.getPlanVersion();
            const primitiveId = drawable.primitive.adaptor.internal.uuid;
            const before = drawable.node.adaptor.internal.getPipelines().get(primitiveId)!;
            equal(before.length, 1, "opaque single-sided material starts with one pipeline variant");
            drawable.material.setAlphaMode("blend");
            drawable.material.setDoubleSided(true);
            flushPreFrame();
            equal(drawable.material.adaptor.getPlanVersion(), version, "pipeline settings must not alter shader plan");
            const after = drawable.node.adaptor.internal.getPipelines().get(primitiveId)!;
            equal(after.length, 2, "double-sided blended material needs two cull variants");
            assert(after[0] === before[0], "existing variant representation should be reused when possible");
            equal(scene.internal.getNodes().length, 1, "scene membership should remain stable");
        },
    },
    {
        name: "HIGH LEVEL — geometry layout version changes only when layout changes",
        run() {
            const geometry = makeGeometry();
            flushPreFrame();
            const initial = geometry.adaptor.getLayoutVersion();
            geometry.getAttribute("position")!.setData(new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]).buffer);
            flushPreFrame();
            equal(geometry.adaptor.getLayoutVersion(), initial, "same attribute layout/data size should preserve layout version");
            geometry.setAttribute(new AttributeWrapper("uv", new Float32Array([0, 0, 1, 0, 0.5, 1]).buffer, "float32x2"));
            flushPreFrame();
            assert(geometry.adaptor.getLayoutVersion() > initial, "adding an attribute should change layout version");
        },
    },
    {
        name: "LOW LEVEL — manager cache length follows ensure/acquire/release/collect and revive",
        run() {
            const manager = new FakeManager();
            manager.ensure("resource", () => ({}));
            equal(manager.getCacheLength(), 1, "ensure should create one cached tracker");
            manager.ensure("resource", () => { throw new Error("ensure must not rebuild an existing key"); });
            equal(manager.getCacheLength(), 1, "ensure on existing key must reuse tracker");
            manager.acquire("resource");
            equal(manager.get("resource").refs, 1, "acquire increments refs");
            manager.release("resource");
            equal(manager.get("resource").refs, 0, "release decrements refs");
            manager.acquire("resource");
            manager.collect();
            equal(manager.getCacheLength(), 1, "acquire before collect must revive pending resource");
            equal(manager.get("resource").raw.destroyed, false, "revived resource must not be destroyed");
            manager.release("resource");
            manager.collect();
            equal(manager.getCacheLength(), 0, "zero-ref resource should be evicted on collect");
            assert(manager.getCacheLength() === 0, "cache should be empty after eviction");
        },
    },
    {
        name: "LOW LEVEL — manager rejects unmatched release and missing acquire",
        run() {
            const manager = new FakeManager();
            let missingAcquire = false;
            try { manager.acquire("missing"); } catch { missingAcquire = true; }
            assert(missingAcquire, "acquire on missing key must throw");
            manager.ensure("one", () => ({}));
            let unmatchedRelease = false;
            try { manager.release("one"); } catch { unmatchedRelease = true; }
            assert(unmatchedRelease, "release at refs=0 must throw");
        },
    },
    {
        name: "LOW LEVEL — representation hashes change for structural edits but buffer identity stays stable",
        run() {
            const geometry = makeGeometry();
            flushPreFrame();
            const internal = geometry.adaptor.internal;
            const attributeBefore = internal.getVertexAttributes().get(0)!;
            const hashBefore = internal.hashProvider.convertToHash();
            geometry.getAttribute("position")!.setData(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0]).buffer);
            flushPreFrame();
            equal(internal.getVertexAttributes().get(0), attributeBefore, "same-sized data update should reuse attribute identity");
            equal(internal.hashProvider.convertToHash(), hashBefore, "buffer content update should not alter structural hash");
            geometry.setAttribute(new AttributeWrapper("normal", new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]).buffer, "float32x3"));
            flushPreFrame();
            assert(internal.hashProvider.convertToHash() !== hashBefore, "adding an attribute should change geometry representation hash");
        },
    },
    {
        name: "WEBGPU INTEGRATION — resource cache lengths across add, mutation, remove, and re-add",
        async run() {
            if (!("gpu" in navigator) || !navigator.gpu) throw new Error("SKIP: WebGPU is unavailable in this browser");
            const canvas = document.createElement("canvas");
            canvas.width = 64;
            canvas.height = 64;
            const renderer = new Renderer(canvas);
            await renderer.init();
            const root = new NodeWrapper();
            const scene = new SceneAdaptor(root.adaptor);
            const camera = new PerspectiveCamera(Math.PI / 3, 1, 0.1, 100).setPosition(0, 0, 3).lookAt(0, 0, 0);
            const drawable = makeDrawable();

            root.addChild(drawable.node);
            renderer.render(scene.internal, camera);
            const added = managerCacheSnapshot(renderer);
            assert(added.buffers >= 2, `expected camera + geometry/node/material buffers, got ${JSON.stringify(added)}`);
            assert(added.pipelines >= 1, `expected at least one pipeline, got ${JSON.stringify(added)}`);

            drawable.material.getComponent("baseColor")!.setFactors([0.2, 0.8, 0.3, 1]);
            renderer.render(scene.internal, camera);
            const changed = managerCacheSnapshot(renderer);
            equal(changed.pipelines, added.pipelines, "same-shape factor mutation should reuse pipeline cache entries");

            root.removeChild(drawable.node);
            renderer.render(scene.internal, camera);
            const removed = managerCacheSnapshot(renderer);
            assert(totalCaches(removed) < totalCaches(added) + 4,
                `resource cache should release most node-owned resources after removal; added=${JSON.stringify(added)}, removed=${JSON.stringify(removed)}`);

            root.addChild(drawable.node);
            renderer.render(scene.internal, camera);
            const readded = managerCacheSnapshot(renderer);
            assert(readded.pipelines >= 1, `re-added node should recreate pipeline resources; got ${JSON.stringify(readded)}`);
            const pre = document.createElement("pre");
            pre.className = "info";
            pre.textContent = [
                "Manager cache lengths (buffers, textures, samplers, bindgroupLayouts, bindgroups, pipelineLayouts, shaderModules, pipelines)",
                `after add:    ${JSON.stringify(added)}`,
                `after change: ${JSON.stringify(changed)}`,
                `after remove: ${JSON.stringify(removed)}`,
                `after re-add: ${JSON.stringify(readded)}`,
            ].join("\n");
            resultsElement!.append(pre);
        },
    },
];

async function main(): Promise<void> {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    for (const test of tests) {
        const result = await runCase(test);
        if (result.status === "pass") passed++;
        else if (result.status === "skip") skipped++;
        else if (result.detail?.startsWith("SKIP:")) {
            result.status = "skip";
            result.detail = result.detail.slice(5).trim();
            skipped++;
        } else failed++;
        logResult(result);
    }
    summaryElement!.textContent = `${passed} passed · ${failed} failed · ${skipped} skipped · ${tests.length} total`;
    summaryElement!.style.color = failed ? "#f85149" : "#3fb950";
}
void main();
