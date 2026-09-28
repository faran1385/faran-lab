import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";
import {Scene} from "./engine/Scene/Scene.ts";
import {Renderer} from "./engine/Renderer/Renderer.ts";
import {GLBLoader} from "./engine/loaders/GLBLoader.ts";
import * as Stats from "stats.js"
const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;
var stats = new Stats.default();
stats.showPanel( 1 ); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild( stats.dom );


const glbLoader = new GLBLoader();

const {root} = await glbLoader.load("/test.glb")
root.setScale(0.001, 0.001, 0.001);
// root.setTranslation(-14, 0, 5)

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.setPosition(0, 1, 3)


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