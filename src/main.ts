import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";
import {Scene} from "./engine/Scene/Scene.ts";
import {Renderer} from "./engine/Renderer/Renderer.ts";
import {GLBLoader} from "./engine/loaders/GLBLoader.ts";
import * as Stats from "stats.js"
import {MaterialWrapper} from "./engine/wrappers/MaterialWrapper.ts";
import {GeometryWrapper} from "./engine/wrappers/GeometryWrapper.ts";
import {PrimitiveWrapper} from "./engine/wrappers/PrimitiveWrapper.ts";
import {MeshWrapper} from "./engine/wrappers/MeshWrapper.ts";
import {NodeWrapper} from "./engine/wrappers/NodeWrapper.ts";
import {AttributeWrapper} from "./engine/wrappers/AttributeWrapper.ts";

const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;
let stats = new Stats.default();
stats.showPanel(1);
document.body.appendChild(stats.dom);

const loader = new GLBLoader();

const {root} = await loader.load("/test.glb");

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
scene.addNode(root);


function frame(): void {

    stats.begin();
    renderer.render(scene, camera)
    stats.end();
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);