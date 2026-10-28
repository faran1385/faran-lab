import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";
import {Scene} from "./engine/Scene/Scene.ts";
import {Renderer} from "./engine/Renderer/Renderer.ts";
import * as Stats from "stats.js";
import {NodeInternal} from "./engine/internals/NodeInternal.ts";
import {MeshInternal} from "./engine/internals/MeshInternal.ts";
import {PrimitiveInternal} from "./engine/internals/PrimitiveInternal.ts";
import {GeometryInternal} from "./engine/internals/GeometryInternal.ts";
import {MaterialInternal} from "./engine/internals/MaterialInternal.ts";
import {PipelineInteractor} from "./engine/Representations/PipelineInteractor.ts";
import {AttributeInternal} from "./engine/internals/AttributeInternal.ts";
import {OrbitControls} from "./engine/Controls/OrbitControls.ts";

const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;
if (!canvas) throw new Error('Missing canvas element "#gpu-canvas".');

const stats = new Stats.default();
stats.showPanel(1);
document.body.appendChild(stats.dom);

const scene = new Scene();
const renderer = new Renderer(canvas);

const camera = new PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
);
camera.setPosition(0, 0, 3);
const controls = new OrbitControls(camera, canvas)
await renderer.init();
renderer.setSize(window.innerWidth, window.innerHeight);

// UVs deliberately extend outside [0, 1].
// Repeat and clamp therefore produce visibly different results.
const positions = new AttributeInternal(
    new Float32Array([
        -1.1, -0.9, 0,
        1.1, -0.9, 0,
        0.0, 1.0, 0,
    ]).buffer,
    {
        arrayStride: 3 * 4,
        stepMode: "vertex",
        attributes: [{
            shaderLocation: 0,
            offset: 0,
            format: "float32x3"
        }]
    },
);


const g = new GeometryInternal();
g.setVertexAttribute(0, positions)

const mat = new MaterialInternal();
const p = new PrimitiveInternal();
p.setGeo(g)
g.setDrawInfo({
    vertexCount: 3
})
p.setMat(mat);
p.vertex.setCode(`

struct VsOut{
    @builtin(position) position:vec4f
}
struct VsIn{
    @location(0) position:vec3f
}


struct CameraUniform{
    viewMatrix:mat4x4f,
    projectionMatrix:mat4x4f,
}

@group(0) @binding(0) var<uniform> camera:CameraUniform;
@group(1) @binding(0) var<uniform> modelMatrix:mat4x4f;

@vertex fn main(in:VsIn)->VsOut{
    return VsOut(camera.projectionMatrix * camera.viewMatrix * modelMatrix * vec4f(in.position,1.));
}
`)
p.fragment.setCode(`

struct VsOut{
    @builtin(position) position:vec4f
}

@fragment fn main(in:VsOut)->@location(0) vec4f{
    return vec4f(1.);
}
`)

const m = new MeshInternal();
m.setPrimitive(p)
const n = new NodeInternal();
n.setMesh(m);
const pipeline = new PipelineInteractor();
pipeline.setVertexBuffers([{
    arrayStride: 3 * 4,
    stepMode: "vertex",
    attributes: [{
        shaderLocation: 0,
        format: "float32x3",
        offset: 0
    }]
}])

pipeline.setDepth({
    depthWriteEnabled: false,
    format: "depth32float"
})
pipeline.setBindgroup(0, Renderer.globalBindgroupInteractor);
pipeline.setBindgroup(1, n.bindgroupInteractor);
pipeline.setPrimitiveState({
    topology: "triangle-list"
})

pipeline.setFrameTargetState({
    format: "bgra8unorm",
    location: 0,
})

n.setPipelines(p.uuid, [pipeline])
scene.addNode(n);

window.addEventListener("resize", () => {
    camera.setAspect(window.innerWidth / window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function frameLoop(): void {
    stats.begin();
    controls.update()
    renderer.render(scene, camera);
    stats.end();
    requestAnimationFrame(frameLoop);
}

frameLoop();
