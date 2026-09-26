import {AttributeWrapper} from "./engine/wrappers/AttributeWrapper.ts";
import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";
import {Scene} from "./engine/Scene/Scene.ts";
import {Renderer} from "./engine/Renderer/Renderer.ts";
import {GeometryWrapper} from "./engine/wrappers/GeometryWrapper.ts";
import {MaterialWrapper} from "./engine/wrappers/MaterialWrapper.ts";
import {PrimitiveWrapper} from "./engine/wrappers/PrimitiveWrapper.ts";
import {MeshWrapper} from "./engine/wrappers/MeshWrapper.ts";
import {NodeWrapper} from "./engine/wrappers/NodeWrapper.ts";
import {IndexAttributeWrapper} from "./engine/wrappers/IndexWrapper.ts";

const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;


const cubePositions = new Float32Array([
    // Front
    -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
    // Back
    1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1,
    // Top
    -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1,
    // Bottom
    -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,
    // Right
    1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1,
    // Left
    -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1,
]);

const cubeIndices = new Uint16Array([
    0, 1, 2, 0, 2, 3,  // front
    4, 5, 6, 4, 6, 7,  // back
    8, 9, 10, 8, 10, 11,  // top
    12, 13, 14, 12, 14, 15,  // bottom
    16, 17, 18, 16, 18, 19,  // right
    20, 21, 22, 20, 22, 23,  // left
]);

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.setPosition(0, 1, 5)

const scene = new Scene();
const renderer = new Renderer(canvas);
await renderer.init()
renderer.setSize(window.innerWidth, window.innerHeight)

const geo = new GeometryWrapper();
geo.addAttribute(new AttributeWrapper("position", cubePositions.buffer, "float32x3"));
geo.setIndices(new IndexAttributeWrapper(cubeIndices.buffer, "uint16"));
const mat = new MaterialWrapper();

const primitive = new PrimitiveWrapper(mat, geo);
const mesh = new MeshWrapper();
mesh.setPrimitive(primitive)
const node = new NodeWrapper();
node.setMesh(mesh)
scene.addNode(node);

function frame(): void {

    renderer.render(scene, camera)
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);