import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";
import {Scene} from "./engine/Scene/Scene.ts";
import {Renderer} from "./engine/Renderer/Renderer.ts";
import * as Stats from "stats.js"
import {NodeWrapper} from "./engine/wrappers/NodeWrapper.ts";
import {GLBLoader} from "./engine/loaders/GLBLoader.ts";
import {OrbitControls} from "./engine/Controls/OrbitControls.ts";
import {GeometryWrapper} from "./engine/wrappers/GeometryWrapper.ts";
import {MaterialWrapper} from "./engine/wrappers/MaterialWrapper.ts";
import {PrimitiveWrapper} from "./engine/wrappers/PrimitiveWrapper.ts";
import {MeshWrapper} from "./engine/wrappers/MeshWrapper.ts";
import {AttributeWrapper} from "./engine/wrappers/AttributeWrapper.ts";

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

const nodeWrapper = new NodeWrapper();
scene.addNode(nodeWrapper)

const g = new GeometryWrapper();
const m = new MaterialWrapper();
const p = new PrimitiveWrapper(m, g);

const n=new NodeWrapper();
n.setMesh(new MeshWrapper())
n.getMesh()!.setPrimitive(p)


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