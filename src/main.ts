import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";
import {Scene} from "./engine/Scene/Scene.ts";
import {Renderer} from "./engine/Renderer/Renderer.ts";
import * as Stats from "stats.js"
import {ImageWrapper} from "./engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "./engine/wrappers/SamplerWrapper.ts";
import {NodeWrapper} from "./engine/wrappers/NodeWrapper.ts";
import {GLBLoader} from "./engine/loaders/GLBLoader.ts";
import {OrbitControls} from "./engine/Controls/OrbitControls.ts";
import {type Draw, GeometryInternal} from "./engine/internals/GeometryInternal.ts";
import {AttributeInternal} from "./engine/internals/AttributeInternal.ts";
import {MaterialInternal} from "./engine/internals/MaterialInternal.ts";
import {PrimitiveInternal} from "./engine/internals/PrimitiveInternal.ts";
import {NodeInternal} from "./engine/internals/NodeInternal.ts";
import {MeshInternal} from "./engine/internals/MeshInternal.ts";
import {NodeAdaptor} from "./engine/adaptors/NodeAdaptor.ts";
import {MeshWrapper} from "./engine/wrappers/MeshWrapper.ts";

const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;
let stats = new Stats.default();
stats.showPanel(1);
document.body.appendChild(stats.dom);

const loader = new GLBLoader();

const {root} = await loader.load("/test.glb")

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.setPosition(0, 0, 10)
// root.setScale(0.01, 0.01, 0.001)
// root.setScale(1000, 1000, 1000)
const controls = new OrbitControls(camera, canvas)


window.addEventListener("resize", () => {
    camera.setAspect(window.innerWidth / window.innerHeight)
    renderer.setSize(window.innerWidth, window.innerHeight)
})

const scene = new Scene();
const renderer = new Renderer(canvas);
await renderer.init()
renderer.setSize(window.innerWidth, window.innerHeight)

// 3 vertices × (x, y, z, u, v) = 3 × 5 floats
const vertexData = new Float32Array([
    //  x     y    z    u    v
    -0.5, -0.5, 0.0, 0.0, 0.0,
    0.5, -0.5, 0.0, 1.0, 0.0,
    0.0, 0.5, 0.0, 0.5, 1.0,
]);

const position = new AttributeInternal(vertexData.buffer, {
    attributes: [
        {
            offset: 0,            // position starts at byte 0
            shaderLocation: 0,
            format: "float32x3"
        },
        {
            offset: 3 * 4,        // UV starts after 3 floats (12 bytes)
            shaderLocation: 1,
            format: "float32x2"
        }
    ],
    arrayStride: 5 * 4           // 5 floats per vertex = 20 bytes
});


const image = new ImageWrapper(new Uint8Array([
    255, 0, 0, 255
]).buffer, 1, 1)
const sampler = new SamplerWrapper();


const g = new GeometryInternal()
g.setVertexAttribute(0, position)
g.setDrawInfo({
    vertexCount: 3,
})
const materialInternal = new MaterialInternal(0);
materialInternal.getBindgroupInteractor().setSampler(0, sampler, GPUShaderStage.FRAGMENT);
materialInternal.getBindgroupInteractor().setTexture(1, image, GPUShaderStage.FRAGMENT);

const primitive = new PrimitiveInternal();
primitive.setGeo(g);
primitive.setMat(materialInternal);
primitive.getVertex().setCode(`
struct VSOut {
    @builtin(position) clip_pos: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn main(
    @location(0) pos: vec3f,
    @location(1) uv: vec2f,
) -> VSOut {
    var out: VSOut;
    out.clip_pos = vec4f(pos, 1.0);
    out.uv = uv;
    return out;
}
`)
primitive.getFragment().setCode(`
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
    return textureSample(tex, samp, uv);
}
`)

const mesh = new MeshInternal();
mesh.setPrimitive(primitive);
const node = new NodeInternal();
node.setMesh(mesh);

const nodeAdaptor = new NodeAdaptor(node);
const nodeWrapper = new NodeWrapper(nodeAdaptor);


scene.addNode(root)

let dt = 0;
let last = performance.now() / 1000;
const frameLoop = () => {
    const now = performance.now() / 1000;
    dt = now - last;
    last = now;
    stats.begin();
    controls.update(dt)

    renderer.render(scene.adaptor.internal, camera);
    stats.end()
    requestAnimationFrame(frameLoop)
}

frameLoop();