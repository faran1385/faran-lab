import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";
import {Scene} from "./engine/Scene/Scene.ts";
import {Renderer} from "./engine/Renderer/Renderer.ts";
import * as Stats from "stats.js";
import {MaterialWrapper} from "./engine/wrappers/MaterialWrapper.ts";
import {GeometryWrapper} from "./engine/wrappers/GeometryWrapper.ts";
import {AttributeWrapper} from "./engine/wrappers/AttributeWrapper.ts";
import {PrimitiveWrapper} from "./engine/wrappers/PrimitiveWrapper.ts";
import {MeshWrapper} from "./engine/wrappers/MeshWrapper.ts";
import {NodeWrapper} from "./engine/wrappers/NodeWrapper.ts";
import {NodeInternal} from "./engine/internals/NodeInternal.ts";
import {NodeAdaptor} from "./engine/Adaptors/NodeAdaptor.ts";
import {MeshInternal} from "./engine/internals/MeshInternal.ts";
import {PrimitiveInternal} from "./engine/internals/PrimitiveInternal.ts";
import {GeometryInternal} from "./engine/internals/GeometryInternal.ts";
import {MaterialInternal} from "./engine/internals/MaterialInternal.ts";
import {PipelineInteractor} from "./engine/Representations/PipelineInteractor.ts";

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

await renderer.init();
renderer.setSize(window.innerWidth, window.innerHeight);

// UVs deliberately extend outside [0, 1].
// Repeat and clamp therefore produce visibly different results.
const positions = new AttributeWrapper(
    "position",
    new Float32Array([
        -1.1, -0.9, 0,
        1.1, -0.9, 0,
        0.0, 1.0, 0,
    ]).buffer,
    "float32x3",
);


const geometry = new GeometryWrapper();
geometry.setAttribute(positions);


const material = new MaterialWrapper();

const primitive = new PrimitiveWrapper(material, geometry);
const mesh = new MeshWrapper();
mesh.setPrimitive(primitive);

const g = new GeometryInternal();
const mat = new MaterialInternal();
const p = new PrimitiveInternal();
p.setGeo(g)
g.setDrawInfo({
    vertexCount: 3
})
p.setMat(mat);
const m = new MeshInternal();
m.setPrimitive(p)
const n = new NodeInternal();
n.setMesh(m);
// node.setMesh(mesh);

scene.addNode(n);


window.addEventListener("resize", () => {
    camera.setAspect(window.innerWidth / window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function frameLoop(): void {
    stats.begin();
    renderer.render(scene, camera);
    stats.end();
    requestAnimationFrame(frameLoop);
}

frameLoop();
