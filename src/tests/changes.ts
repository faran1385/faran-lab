import {formatCounts, pixelAt, type Rig} from "./rig.ts";
import {gpuClean, NOTHING, newRig, quietFrames, type StepExpectation, sameResources, trigger} from "./checks.ts";
import {
    CountingVertexAssembler,
    gridData,
    makeCountingPrimitive,
    makeGeometry,
    makeMaterial,
    makeMesh,
    makeNode,
    makeTexture,
    pixelBytes,
    positionAttribute,
    TaggedVertexAssembler,
    uvAttribute,
} from "./scenes.ts";
import {PrimitiveWrapper} from "../engine/wrappers/PrimitiveWrapper.ts";
import {MaterialComponentWrapper} from "../engine/wrappers/MaterialComponentWrapper.ts";
import {IndexAttributeWrapper} from "../engine/wrappers/IndexWrapper.ts";
import {ImageWrapper} from "../engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "../engine/wrappers/SamplerWrapper.ts";
import {TextureWrapper} from "../engine/wrappers/TextureWrapper.ts";
import {PerspectiveCamera} from "../engine/Camera/PerspectiveCamera.ts";
import type {Scenario, TestCtx} from "./util.ts";
import {internalScenarios} from "./internals.ts";

/**
 * Change-trigger tests.
 *
 * The engine's contract is "a setter only records that something changed; the frame does the least work that makes
 * the change visible". Every case here is one setter call, followed by a look at what the engine did because of it:
 *
 *   created      GPU objects the managers had to create (buffers, textures, samplers, shader modules, layouts,
 *                bind groups, pipelines)
 *   writes       in-place uploads (queue.writeBuffer / writeTexture)
 *   hashing      calls to the hasher
 *   epoch        whether any change stamp moved (stamps are what makes cached render items be rebuilt)
 *
 * A case passes when the change cost what it should: a factor value is one upload and nothing else, a different
 * vertex layout is a new shader module and pipeline, a settings-only change never re-runs the shader assemblers, and
 * after every change the engine goes quiet again (no GPU object, no upload, no hash, no stamp on idle frames).
 * Hard expectations make the case fail; `hint`s are efficiency expectations that only warn.
 *
 * "high-level-*" scenarios drive the wrappers (what an application calls). "low-level-*" scenarios (internals.ts)
 * drive the internals, representations, hash providers, queues and managers directly, with no wrapper or adapter.
 */

/** What one scene with one textured, counted primitive looks like once it is drawn. */
interface Fixture {
    rig: Rig;
    texture: TextureWrapper;
    geometry: ReturnType<typeof makeGeometry>;
    material: ReturnType<typeof makeMaterial>;
    counted: ReturnType<typeof makeCountingPrimitive>;
    mesh: ReturnType<typeof makeMesh>;
    node: ReturnType<typeof makeNode>;
}

async function fixture(ctx: TestCtx): Promise<Fixture> {
    const rig = await newRig(ctx);
    const texture = makeTexture(2, [255, 0, 0, 255]);
    const geometry = makeGeometry({uv: true});
    const material = makeMaterial({texture, color: [0.2, 0.6, 0.9]});
    const counted = makeCountingPrimitive(material, geometry);
    const mesh = makeMesh(counted.primitive);
    const node = makeNode(mesh, [0, 0, 0], 3);
    rig.scene.addNode(node);
    await rig.render(3);
    gpuClean(ctx, rig, "fixture");
    await quietFrames(ctx, rig, "fixture is quiet");
    return {rig, texture, geometry, material, counted, mesh, node};
}


// -- nodes --------------------------------------------------------------------------------------------------------

const highNode: Scenario = {
    name: "high-level-node",
    description: "NodeWrapper: transforms are one matrix upload and nothing else, name is free, mesh / scene membership create and release exactly the node's resources.",
    run: async (ctx) => {
        const {rig, node, mesh} = await fixture(ctx);
        const idle: StepExpectation = {created: NOTHING, hashing: "none", epoch: "still"};

        await trigger(ctx, rig, "setTranslation", () => node.setTranslation(1, 0, 0), {...idle, bufferWrites: 1});
        await trigger(ctx, rig, "setRotation", () => node.setRotation(0, 0.3, 0), {...idle, bufferWrites: 1});
        await trigger(ctx, rig, "setScale", () => node.setScale(2, 2, 2), {...idle, bufferWrites: 1});
        await trigger(ctx, rig, "three setters in one frame", () => {
            node.setTranslation(0, 0, 0);
            node.setRotation(0, 0, 0);
            node.setScale(3, 3, 3);
        }, {...idle, bufferWrites: 1});
        await trigger(ctx, rig, "setName", () => node.setName("renamed"), {...idle, bufferWrites: 0});

        // the matrix has to be right, not just uploaded: at x = 2 the quad is drawn there and no longer at the centre
        node.setTranslation(2, 0, 0);
        const pixels = await rig.readPixels();
        const lit = (x: number, y: number) => pixelAt(pixels, Math.round(x), Math.round(y)).slice(0, 3).some((c) => c > 4);
        const [movedX, movedY] = rig.project(2, 0, 0);
        const [oldX, oldY] = rig.project(0, 0, 0);
        ctx.check(lit(movedX, movedY), "after setTranslation(2,0,0) nothing is drawn where the node now is");
        ctx.check(!lit(oldX - 40, oldY), "after setTranslation(2,0,0) the node is still drawn where it was");
        gpuClean(ctx, rig, "readback");
        node.setTranslation(0, 0, 0);

        // mesh / scene membership: the node's resources go and come back, the shared ones stay
        const full = rig.snapshot();
        await trigger(ctx, rig, "setMesh(null)", () => node.setMesh(null), {hashing: "none"});
        ctx.check(rig.addedSinceBaseline().pipeline === 0 && rig.addedSinceBaseline().buffer === 0,
            `a node without a mesh still holds ${formatCounts(rig.addedSinceBaseline())}`);
        await trigger(ctx, rig, "setMesh(mesh) again", () => node.setMesh(mesh), {});
        sameResources(ctx, rig, "mesh removed and set again", full);

        await trigger(ctx, rig, "scene.removeNode", () => rig.scene.removeNode(node), {});
        ctx.check(rig.addedSinceBaseline().buffer === 0, `a node that left the scene still holds ${formatCounts(rig.addedSinceBaseline())}`);
        await trigger(ctx, rig, "scene.addNode again", () => rig.scene.addNode(node), {});
        sameResources(ctx, rig, "node removed and added again", full);

        // child nodes: a child moves with its parent, and detaching it releases its resources
        const parent = makeNode(null, [0, 0, 0], 1);
        const child = makeNode(mesh, [1, 0, 0], 1);
        parent.addChild(child);
        await trigger(ctx, rig, "scene.addNode(parent with a child)", () => rig.scene.addNode(parent), {});
        await trigger(ctx, rig, "moving the parent moves the child", () => parent.setTranslation(0.5, 0, 0), {...idle, bufferWrites: 1});
        ctx.check(Math.abs(child.getWorldMatrix()[12] - 1.5) < 1e-5, `the child's world x is ${child.getWorldMatrix()[12]}, expected 1.5`);
        await trigger(ctx, rig, "parent.removeChild", () => parent.removeChild(child), {});
        await trigger(ctx, rig, "scene.removeNode(parent)", () => rig.scene.removeNode(parent), {});
    },
};

// -- meshes and primitives -----------------------------------------------------------------------------------------

const highMeshAndPrimitive: Scenario = {
    name: "high-level-mesh-primitive",
    description: "MeshWrapper / PrimitiveWrapper: adding a primitive that shares material and geometry creates nothing; a new material or geometry creates only what differs; swapping assemblers regenerates code only when it must.",
    run: async (ctx) => {
        const {rig, mesh, counted, material, geometry} = await fixture(ctx);
        const initial = rig.snapshot();

        // a second primitive over the same material and geometry: one more draw, no GPU object
        const twin = new PrimitiveWrapper(material, geometry);
        await trigger(ctx, rig, "mesh.setPrimitive (same material + geometry)", () => mesh.setPrimitive(twin), {created: NOTHING, bufferWrites: 0});
        await trigger(ctx, rig, "mesh.removePrimitive", () => mesh.removePrimitive(twin.uuid), {created: NOTHING}, {sameAfter: true});

        // a primitive with another material of the same shape: its own factors buffer and bind group, nothing else
        const other = makeMaterial({color: [1, 0, 0], texture: material.getComponent("baseColor")!.getTexture()!.wrapper});
        const second = new PrimitiveWrapper(other, geometry);
        await trigger(ctx, rig, "mesh.setPrimitive (new material, same shape)", () => mesh.setPrimitive(second), {
            created: {buffer: 1, bindgroup: 1},
        });
        await trigger(ctx, rig, "mesh.removePrimitive (that primitive)", () => mesh.removePrimitive(second.uuid), {created: NOTHING});
        sameResources(ctx, rig, "primitive added and removed again", initial);

        // swapping the material of a primitive
        const swapped = makeMaterial({color: [0, 1, 0], texture: material.getComponent("baseColor")!.getTexture()!.wrapper});
        await trigger(ctx, rig, "primitive.setMaterial (same shape)", () => counted.primitive.setMaterial(swapped), {
            created: {buffer: 1, bindgroup: 1},
        }, {sameAfter: true});

        const withEmissive = makeMaterial({color: [0, 1, 0], texture: material.getComponent("baseColor")!.getTexture()!.wrapper});
        withEmissive.setComponent(new MaterialComponentWrapper("emissive", [0, 0, 0, 1]));
        const step = await trigger(ctx, rig, "primitive.setMaterial (different component set)", () => counted.primitive.setMaterial(withEmissive), {
            created: {buffer: 1, bindgroup: 1, shaderModule: 1, pipeline: 1},
        }, {sameAfter: true});
        void step;
        await trigger(ctx, rig, "primitive.setMaterial (back to the plain shape)", () => counted.primitive.setMaterial(swapped), {}, {sameAfter: true});

        // swapping the geometry
        const bigger = makeGeometry({uv: true, cols: 4, rows: 4});
        await trigger(ctx, rig, "primitive.setGeometry (same layout, other data)", () => counted.primitive.setGeometry(bigger), {
            created: {buffer: 2},
        }, {sameAfter: true});
        const noUv = makeGeometry({});
        await trigger(ctx, rig, "primitive.setGeometry (different layout: no uv)", () => counted.primitive.setGeometry(noUv), {
            created: {buffer: 1, shaderModule: 1, pipeline: 1},
        });
        await trigger(ctx, rig, "primitive.setGeometry (back)", () => counted.primitive.setGeometry(geometry), {});

        // assemblers
        const vertexRuns = counted.vertex.calls;
        const sameCode = new CountingVertexAssembler();
        await trigger(ctx, rig, "primitive.setVertexAssembler (new instance, same code)", () => counted.primitive.setVertexAssembler(sameCode), {
            created: NOTHING,
            bufferWrites: 0,
        }, {sameAfter: true});
        ctx.check(sameCode.calls >= 1, "the new vertex assembler never ran, so the primitive keeps using the old shader code");
        ctx.check(counted.vertex.calls === vertexRuns, "the replaced vertex assembler ran again after it was replaced");

        const fragmentRunsBefore = counted.fragment.calls;
        await trigger(ctx, rig, "primitive.setVertexAssembler (different code)", () => counted.primitive.setVertexAssembler(new TaggedVertexAssembler("v2")), {
            created: {shaderModule: 1, pipeline: 1},
        }, {
            hint: {created: {shaderModule: 1, pipeline: 1}},
        });
        ctx.warn(counted.fragment.calls === fragmentRunsBefore,
            `swapping only the vertex assembler re-ran the fragment assembler ${counted.fragment.calls - fragmentRunsBefore} time(s)`);
    },
};

// -- materials and components ---------------------------------------------------------------------------------------

const highMaterial: Scenario = {
    name: "high-level-material",
    description: "MaterialWrapper / MaterialComponentWrapper: factor values are an upload; pipeline settings never re-run the assemblers; the component set and its shape change the shader and the pipeline.",
    run: async (ctx) => {
        const {rig, material, counted} = await fixture(ctx);
        const base = material.getComponent("baseColor")!;
        const idle: StepExpectation = {created: NOTHING, hashing: "none", epoch: "still"};

        // values
        await trigger(ctx, rig, "component.setFactors (same arity)", () => base.setFactors([1, 0.5, 0.25, 1]), {...idle, bufferWrites: 1});
        await trigger(ctx, rig, "component.setFactors x3 in one frame", () => {
            base.setFactors([0, 0, 0, 1]);
            base.setFactors([0.1, 0.1, 0.1, 1]);
            base.setFactors([0.9, 0.9, 0.9, 1]);
        }, {...idle, bufferWrites: 1});
        await trigger(ctx, rig, "material.setAlphaCutoff", () => material.setAlphaCutoff(0.5), {...idle, bufferWrites: 1});

        // a different arity changes the struct layout: new buffer, new shader, new pipeline
        await trigger(ctx, rig, "component.setFactors (vec4 -> vec3)", () => base.setFactors([1, 0, 0]), {
            created: {buffer: 1, bindgroup: 1, shaderModule: 1, pipeline: 1},
        }, {sameAfter: true});
        await trigger(ctx, rig, "component.setFactors (vec3 -> vec4)", () => base.setFactors([1, 0, 0, 1]), {}, {sameAfter: true});

        // settings: pipelines only, the assemblers must not run
        const vertexRuns = counted.vertex.calls;
        const fragmentRuns = counted.fragment.calls;
        await trigger(ctx, rig, "material.setAlphaMode('mask') (same pipeline state)", () => material.setAlphaMode("mask"), {
            created: NOTHING, bufferWrites: 0, hashing: "none", epoch: "still",
        });
        await trigger(ctx, rig, "material.setAlphaMode('blend') (double-sided: two pipelines)", () => material.setAlphaMode("blend"), {
            created: {pipeline: 2},
        });
        // blend + single-sided is the "back" pipeline the two-pipeline pair already contains: reused, nothing created
        await trigger(ctx, rig, "material.setDoubleSided(false) (reuses the existing back-cull pipeline)", () => material.setDoubleSided(false), {
            created: NOTHING,
        });
        const toggled = await trigger(ctx, rig, "material.setAlphaMode('opaque')", () => material.setAlphaMode("opaque"), {created: {pipeline: 1}});
        ctx.check(counted.vertex.calls === vertexRuns && counted.fragment.calls === fragmentRuns,
            `alphaMode / doubleSided changes re-ran the assemblers (vertex +${counted.vertex.calls - vertexRuns}, fragment +${counted.fragment.calls - fragmentRuns}); they only change pipeline state`);
        void toggled;

        const back = await rig.step(() => {
            material.setDoubleSided(true);
        });
        ctx.warn(back.created.pipeline === 0,
            `setDoubleSided(true) after setDoubleSided(false) compiled ${back.created.pipeline} pipeline(s) again: the old one was destroyed a frame after it was last used. Toggling a material setting back and forth recompiles every time (planned: a grace window for eviction).`);
        await rig.render(2);

        // components
        const emissive = new MaterialComponentWrapper("emissive", [0, 0, 0, 1]);
        await trigger(ctx, rig, "material.setComponent (new component)", () => material.setComponent(emissive), {
            created: {buffer: 1, bindgroup: 1, shaderModule: 1, pipeline: 1},
        });
        await trigger(ctx, rig, "emissive.setFactors", () => emissive.setFactors([1, 1, 1, 1]), {...idle, bufferWrites: 1});
        await trigger(ctx, rig, "material.removeComponent", () => material.removeComponent("emissive"), {
            created: {buffer: 1, bindgroup: 1, shaderModule: 1, pipeline: 1},
        });
        ctx.check(rig.addedSinceBaseline().pipeline === 1, `after removing the component the scene holds ${rig.addedSinceBaseline().pipeline} pipelines, expected 1`);

        // replacing a component with an identical-shaped one: values only
        const replacement = new MaterialComponentWrapper("baseColor", [0.3, 0.3, 0.3, 1]);
        replacement.setTexture(base.getTexture()!);
        await trigger(ctx, rig, "material.setComponent (same name, same shape)", () => material.setComponent(replacement), {
            created: NOTHING,
            bufferWrites: 1,
        });
    },
};

const highTextures: Scenario = {
    name: "high-level-texture",
    description: "Textures, images and samplers: new pixels are a texture upload, a new image is a new texture, a sampler setting is a new sampler, removing the texture changes the bind group layout. Also: changes made on a TextureWrapper must reach the bind group.",
    run: async (ctx) => {
        const {rig, material, texture} = await fixture(ctx);
        const base = material.getComponent("baseColor")!;
        const image = texture.getImage();
        const sampler = texture.getSampler();

        // pixels
        await trigger(ctx, rig, "image.setData (same size)", () => image.setData(pixelBytes(2, [0, 255, 0, 255])), {
            created: NOTHING, textureWrites: 1,
        });
        await trigger(ctx, rig, "image.setData x2 in one frame", () => {
            image.setData(pixelBytes(2, [0, 0, 255, 255]));
            image.setData(pixelBytes(2, [255, 255, 0, 255]));
        }, {created: NOTHING, textureWrites: 1});

        // size: another GPU texture (and a bind group that points at it)
        await trigger(ctx, rig, "image.setData + setDimensions (2x2 -> 4x4)", () => {
            image.setData(pixelBytes(4, [10, 20, 30, 255]));
            image.setDimensions(4, 4);
        }, {created: {texture: 1, bindgroup: 1}, textureWrites: 1}, {sameAfter: true});

        // sampler settings
        await trigger(ctx, rig, "sampler.setMinFilter", () => sampler.setMinFilter("nearest"), {
            created: {sampler: 1, bindgroup: 1}, bufferWrites: 0, textureWrites: 0,
        }, {sameAfter: true});
        await trigger(ctx, rig, "sampler.setAddressModeU", () => sampler.setAddressModeU("clamp-to-edge"), {
            created: {sampler: 1, bindgroup: 1},
        }, {sameAfter: true});

        // the material's texture slot
        const other = makeTexture(2, [0, 0, 255, 255]);
        await trigger(ctx, rig, "component.setTexture (other image)", () => base.setTexture({wrapper: other, texCoord: "uv0"}), {
            created: {texture: 1, bindgroup: 1, sampler: 1},
        }, {sameAfter: true});
        await trigger(ctx, rig, "component.setTexture (same texture again)", () => base.setTexture({wrapper: other, texCoord: "uv0"}), {
            created: NOTHING,
        });

        // a TextureWrapper that is already bound is edited. The bind group holds the image and the sampler, so these
        // only reach the GPU if the material hears about them.
        const replacementImage = new ImageWrapper(pixelBytes(2, [255, 0, 255, 255]), 2, 2);
        const vertexRunsBeforeImageSwap = counted.vertex.calls;
        const fragmentRunsBeforeImageSwap = counted.fragment.calls;
        await trigger(ctx, rig, "textureWrapper.setImage (resource-only swap on a bound texture)", () => other.setImage(replacementImage), {
            created: {texture: 1, bindgroup: 1},
        }, {sameAfter: true});
        ctx.check(counted.vertex.calls === vertexRunsBeforeImageSwap && counted.fragment.calls === fragmentRunsBeforeImageSwap,
            "replacing a bound texture's image re-ran shader assembly; a resource-only swap must not invalidate shader code");

        const vertexRunsBeforeSamplerSwap = counted.vertex.calls;
        const fragmentRunsBeforeSamplerSwap = counted.fragment.calls;
        await trigger(ctx, rig, "textureWrapper.setSampler (resource-only swap on a bound texture)", () => other.setSampler(new SamplerWrapper("nearest", "nearest", "nearest", "mirror-repeat", "mirror-repeat")), {
            created: {sampler: 1, bindgroup: 1},
        }, {sameAfter: true});
        ctx.check(counted.vertex.calls === vertexRunsBeforeSamplerSwap && counted.fragment.calls === fragmentRunsBeforeSamplerSwap,
            "replacing a bound texture's sampler re-ran shader assembly; a resource-only swap must not invalidate shader code");

        // removing the texture: the bind group layout loses its bindings (layout, pipeline layout, pipeline) and both shaders stop reading uv
        await trigger(ctx, rig, "component.removeTexture", () => base.removeTexture(), {
            created: {shaderModule: 2, bindgroupLayout: 1, pipelineLayout: 1, bindgroup: 1, pipeline: 1},
        });
        ctx.check(rig.addedSinceBaseline().texture === 0 && rig.addedSinceBaseline().sampler === 0,
            `the texture is gone from the material but the scene still holds ${rig.addedSinceBaseline().texture} texture(s) and ${rig.addedSinceBaseline().sampler} sampler(s)`);
        await trigger(ctx, rig, "component.setTexture (back)", () => base.setTexture({wrapper: other, texCoord: "uv0"}), {
            created: {shaderModule: 2, bindgroupLayout: 1, pipelineLayout: 1, bindgroup: 1, pipeline: 1, texture: 1, sampler: 1},
        });
    },
};

const highGeometry: Scenario = {
    name: "high-level-geometry",
    description: "GeometryWrapper / AttributeWrapper: same-sized data is an in-place upload, a different size or layout creates what differs, and new data written to an attribute wrapper must reach the GPU.",
    run: async (ctx) => {
        const {rig, geometry} = await fixture(ctx);
        const data = gridData({uv: true});

        // replacing an attribute with same-sized data
        const moved = new Float32Array(data.positions);
        moved[0] += 0.1;
        await trigger(ctx, rig, "geometry.setAttribute (same name, same size)", () => geometry.setAttribute(positionAttribute(moved)), {
            created: NOTHING, bufferWrites: 1,
        }, {hint: {epoch: "still", hashing: "none"}});

        // writing into the attribute wrapper that is already part of the geometry
        const position = geometry.getAttribute("position")!;
        const rewritten = new Float32Array(position.getData().slice(0));
        rewritten[1] += 0.1;
        await trigger(ctx, rig, "attributeWrapper.setData (same size, wrapper already in the geometry)", () => position.setData(rewritten.buffer as ArrayBuffer), {
            created: NOTHING, bufferWrites: 1,
        });

        // a different size is a different GPU buffer
        const bigger = gridData({cols: 2, rows: 1, uv: true});
        await trigger(ctx, rig, "geometry.setAttribute (bigger data)", () => {
            geometry.setAttribute(positionAttribute(bigger.positions));
            geometry.setAttribute(uvAttribute(bigger.uvs!));
        }, {created: {buffer: 2}});

        // a different layout is another vertex shader and another pipeline
        await trigger(ctx, rig, "geometry.setAttribute (new attribute 'uv1')", () => geometry.setAttribute(uvAttribute(bigger.uvs!, "uv1")), {
            created: {buffer: 1, shaderModule: 1, pipeline: 1},
        });
        await trigger(ctx, rig, "geometry.removeAttribute('uv1')", () => geometry.removeAttribute("uv1"), {
            created: {shaderModule: 1, pipeline: 1},
        });
        await trigger(ctx, rig, "geometry.removeAttribute('uv0')", () => geometry.removeAttribute("uv0"), {
            created: {shaderModule: 1, pipeline: 1},
        });
        await trigger(ctx, rig, "geometry.setAttribute('uv0') (back)", () => geometry.setAttribute(uvAttribute(bigger.uvs!)), {
            created: {buffer: 1, shaderModule: 1, pipeline: 1},
        });

        // indices: an index buffer, and the draw becomes indexed
        const indexed = gridData({cols: 1, rows: 1, uv: true, indexed: true});
        const indices = new IndexAttributeWrapper((indexed.indices as Uint16Array).buffer as ArrayBuffer, "uint16");
        await trigger(ctx, rig, "geometry.setIndices", () => {
            geometry.setAttribute(positionAttribute(indexed.positions));
            geometry.setAttribute(uvAttribute(indexed.uvs!));
            geometry.setIndices(indices);
        }, {created: {buffer: 3}});
        ctx.check(rig.addedSinceBaseline().pipeline === 1, `${rig.addedSinceBaseline().pipeline} pipelines after the geometry became indexed, expected 1 (an index buffer is not part of the pipeline)`);

        const flipped = new Uint16Array((indices.getData() as ArrayBuffer).slice(0));
        flipped.reverse();
        await trigger(ctx, rig, "indexAttributeWrapper.setData (same size)", () => indices.setData(flipped.buffer as ArrayBuffer), {
            created: NOTHING, bufferWrites: 1,
        });
        await trigger(ctx, rig, "geometry.clearIndices", () => {
            geometry.clearIndices();
            geometry.setAttribute(positionAttribute(data.positions));
            geometry.setAttribute(uvAttribute(data.uvs!));
        }, {created: {buffer: 2}});
        ctx.check(rig.addedSinceBaseline().buffer === 4, `${rig.addedSinceBaseline().buffer} buffers after the indices were cleared, expected 4 (position, uv, node matrix, factors)`);
    },
};

// -- the frame's own inputs -----------------------------------------------------------------------------------------

const highFrame: Scenario = {
    name: "high-level-camera-and-target",
    description: "The camera is an upload (view and projection separately), a different camera object re-uploads both, a different colour target format rebuilds the pipelines of every node.",
    run: async (ctx) => {
        const {rig} = await fixture(ctx);
        const idle: StepExpectation = {created: NOTHING, hashing: "none", epoch: "still"};

        await trigger(ctx, rig, "camera.setPosition", () => rig.camera.setPosition(0.5, 0, 8), {...idle, bufferWrites: 1});
        await trigger(ctx, rig, "camera.lookAt", () => rig.camera.lookAt(0.1, 0, 0), {...idle, bufferWrites: 1});
        await trigger(ctx, rig, "camera.setFov", () => rig.camera.setFov(60), {...idle, bufferWrites: 1});
        await trigger(ctx, rig, "camera.setAspect + setNear + setFar", () => {
            rig.camera.setAspect(1.5).setNear(0.2).setFar(50);
        }, {...idle, bufferWrites: 1});
        await trigger(ctx, rig, "camera.setPosition + setFov together", () => {
            rig.camera.setPosition(0, 0, 8);
            rig.camera.setFov(45);
        }, {...idle, bufferWrites: 2});

        const replacement = new PerspectiveCamera(45, 1, 0.1, 100);
        replacement.setPosition(0, 0, 8);
        await trigger(ctx, rig, "a different camera object", () => {
            rig.camera = replacement;
        }, {...idle, bufferWrites: 2});

        // The colour target format is part of every pipeline. Three nodes share one pipeline: one new pipeline, not three.
        const extra = [makeNode(rig.scene.getRootNodes()[0].getMesh(), [1, 1, 0], 1), makeNode(rig.scene.getRootNodes()[0].getMesh(), [-1, 1, 0], 1)];
        for (const node of extra) rig.scene.addNode(node);
        await rig.render(3);
        gpuClean(ctx, rig, "extra nodes");

        const formatBefore = rig.frameInfo.colorFormat;
        let newFormat = formatBefore;
        await trigger(ctx, rig, "colour target format changes", () => {
            newFormat = rig.swapColorTargetFormat();
        }, {created: {pipeline: 1}, bufferWrites: 0}, {sameAfter: true});
        ctx.check(rig.frameInfo.colorFormat === newFormat, `the renderer still reports ${rig.frameInfo.colorFormat} after the target became ${newFormat}`);
        await trigger(ctx, rig, "colour target format changes back", () => rig.restoreColorTarget(), {created: {pipeline: 1}}, {sameAfter: true});
        ctx.check(rig.frameInfo.colorFormat === formatBefore, `the renderer reports ${rig.frameInfo.colorFormat} after the target was restored to ${formatBefore}`);
    },
};

export const changeScenarios: Scenario[] = [
    highNode,
    highMeshAndPrimitive,
    highMaterial,
    highTextures,
    highGeometry,
    highFrame,
    ...internalScenarios,
];
