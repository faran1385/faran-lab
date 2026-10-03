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
import {MaterialComponentWrapper} from "./engine/wrappers/MaterialComponentWrapper.ts";
import {TextureWrapper} from "./engine/wrappers/TextureWrapper.ts";
import {ImageWrapper} from "./engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "./engine/wrappers/SamplerWrapper.ts";

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


const pa1 = new AttributeWrapper("position", new Float32Array([
    -0.5, -0.5, 0.0,
    0.5, -0.5, 0.0,
    0.0, 0.5, 0.0
]).buffer, "float32x3")

const uv1 = new AttributeWrapper("uv", new Float32Array([
    0.0, 1.0,
    1.0, 1.0,
    0.5, 0.0
]).buffer, "float32x2")

const color1 = new AttributeWrapper("color", new Float32Array([
    1, 0, 0, 1.0,
    0, 1, 0, 1.0,
    0, 0, 1, 1.0,
]).buffer, "float32x4")

const w = 3;
const h = 1;
const data = new Uint8Array([
    255, 0, 0, 1, 0, 255, 0, 1, 0, 0, 255, 1,
]);


const mat1 = new MaterialWrapper();
const mc = new MaterialComponentWrapper("baseColor", [1, 1, 1]);
mc.setTexture({
    wrapper: new TextureWrapper(
        new ImageWrapper(data.buffer, w, h),
        new SamplerWrapper(
            "linear",
            "linear",
            "linear",
            "clamp-to-edge"
        )
    ),
    texCoord: "uv"
})

mat1.setComponent(mc)
const geo1 = new GeometryWrapper();
geo1.setAttribute(pa1);
geo1.setAttribute(uv1);
geo1.setAttribute(color1);
const mesh1 = new MeshWrapper();
const p1 = new PrimitiveWrapper(mat1, geo1);
const node1 = new NodeWrapper();
mesh1.setPrimitive(p1)
node1.setMesh(mesh1)
scene.addNode(node1)

window.addEventListener("click", () => {
    const data2 = pa1.getData();
    const pa1NewData = new Float32Array(data2)
    pa1NewData.set([-1], 0)
    console.log(pa1NewData)
    pa1.setData(pa1NewData.buffer)

    const data = mc.getTexture()!.wrapper.getImage().getData();
    const newData = new Uint8Array(data)
    newData.set([0, 0, 0], 0)
    mc.getTexture()?.wrapper.getImage().setData(newData.buffer)
})


function frame(): void {

    stats.begin();
    renderer.render(scene, camera)
    stats.end();
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);