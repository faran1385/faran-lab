import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";
import {Scene} from "./engine/Scene/Scene.ts";
import {Renderer} from "./engine/Renderer/Renderer.ts";
import * as Stats from "stats.js"
import {ImageWrapper} from "./engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "./engine/wrappers/SamplerWrapper.ts";
import {TextureWrapper} from "./engine/wrappers/TextureWrapper.ts";
import {MaterialComponentWrapper} from "./engine/wrappers/MaterialComponentWrapper.ts";
import {GeometryWrapper} from "./engine/wrappers/GeometryWrapper.ts";
import {MeshWrapper} from "./engine/wrappers/MeshWrapper.ts";
import {PrimitiveWrapper} from "./engine/wrappers/PrimitiveWrapper.ts";
import {MaterialWrapper} from "./engine/wrappers/MaterialWrapper.ts";
import {NodeWrapper} from "./engine/wrappers/NodeWrapper.ts";
import type {GeometryModel} from "./tests/sim.ts";
import {AttributeWrapper} from "./engine/wrappers/AttributeWrapper.ts";

const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;
let stats = new Stats.default();
stats.showPanel(1);
document.body.appendChild(stats.dom);


const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.setPosition(0, 0, 3)


window.addEventListener("resize", () => {
    camera.setAspect(window.innerWidth / window.innerHeight)
    renderer.setSize(window.innerWidth, window.innerHeight)
})

const scene = new Scene();
const renderer = new Renderer(canvas);
await renderer.init()
renderer.setSize(window.innerWidth, window.innerHeight)

const position = new AttributeWrapper("position", new Float32Array([
    -0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0
]).buffer, "float32x3");

const image = new ImageWrapper(new Uint8Array([
    255, 0, 0, 255
]).buffer, 1, 1)
const sampler = new SamplerWrapper();
const texture = new TextureWrapper(image, sampler);
const material = new MaterialWrapper();
const mc = new MaterialComponentWrapper("baseColor", [1, 1, 1]);
mc.setTexture({
    texCoord: '0',
    wrapper: texture
});

material.setComponent(mc);
const geometry = new GeometryWrapper();
geometry.setAttribute(position)
const mesh = new MeshWrapper();
mesh.setPrimitive(
    new PrimitiveWrapper(
        material,
        geometry
    )
);
const node = new NodeWrapper();
node.setMesh(mesh);
scene.addNode(node);
renderer.render(scene, camera);

const hashBefore = texture.hashProvider.convertToHash(renderer.hasher);

console.log("hash before eviction:", hashBefore);

scene.removeNode(node);

renderer.render(scene, camera);

scene.addNode(node);

renderer.render(scene, camera);

const hashAfter = texture.hashProvider.convertToHash(renderer.hasher);

console.log("hash after recreation:", hashAfter);