import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";
import {Scene} from "./engine/Scene/Scene.ts";
import {Renderer} from "./engine/Renderer/Renderer.ts";
import * as Stats from "stats.js"
import {ImageWrapper} from "./engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "./engine/wrappers/SamplerWrapper.ts";
import {NodeWrapper} from "./engine/wrappers/NodeWrapper.ts";
import {GLBLoader} from "./engine/loaders/GLBLoader.ts";
import {OrbitControls} from "./engine/Controls/OrbitControls.ts";
import {GeometryInternal} from "./engine/internals/GeometryInternal.ts";
import {AttributeInternal} from "./engine/internals/AttributeInternal.ts";
import {MaterialInternal} from "./engine/internals/MaterialInternal.ts";
import {PrimitiveInternal} from "./engine/internals/PrimitiveInternal.ts";
import {NodeInternal} from "./engine/internals/NodeInternal.ts";
import {MeshInternal} from "./engine/internals/MeshInternal.ts";
import {NodeAdaptor} from "./engine/Adaptors/NodeAdaptor.ts";
import {PipelineInteractor} from "./engine/Representations/PipelineInteractor.ts";

const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;
let stats = new Stats.default();
stats.showPanel(1);
document.body.appendChild(stats.dom);

const loader = new GLBLoader();

// const {root} = await loader.load("/test.glb")

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