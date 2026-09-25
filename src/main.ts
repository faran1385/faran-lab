import {GeometryWrapper} from "./engine/wrappers/GeometryWrapper.ts";
import {AttributeWrapper} from "./engine/wrappers/AttributeWrapper.ts";
import {MaterialWrapper} from "./engine/wrappers/MaterialWrapper.ts";
import {PrimitiveWrapper} from "./engine/wrappers/PrimitiveWrapper.ts";
import {MeshWrapper} from "./engine/wrappers/MeshWrapper.ts";
import {NodeWrapper} from "./engine/wrappers/NodeWrapper.ts";
import {MaterialComponentWrapper} from "./engine/wrappers/MaterialComponentWrapper.ts";
import {TextureWrapper} from "./engine/wrappers/TextureWrapper.ts";
import {ImageWrapper} from "./engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "./engine/wrappers/SamplerWrapper.ts";
import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";
import {Scene} from "./engine/Scene/Scene.ts";
import {Renderer} from "./engine/Renderer/Renderer.ts";

const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;

const vertexData = new Float32Array([
    -0.5, -0.5, 0.0,
    0.5, -0.5, 0.0,
    0.0, 0.5, 0.0,
]);

const uvs = new Float32Array([
    1 / 6, 0.5,   // vertex 0 → RED
    0.5, 0.5,   // vertex 1 → GREEN
    5 / 6, 0.5,   // vertex 2 → BLUE
]);
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.setPosition(0, 0, 3)


const scene = new Scene();
const renderer = new Renderer(canvas);
await renderer.init()
renderer.setSize(window.innerWidth,window.innerHeight)

const posAttr = new AttributeWrapper("position", vertexData.buffer, "float32x3");
const uvAttr = new AttributeWrapper("uv0", uvs.buffer, "float32x2");
const geo = new GeometryWrapper()
geo.addAttribute(posAttr)
geo.addAttribute(uvAttr)
const mat = new MaterialWrapper("opaque", 0, false)
mat.setComponent(new MaterialComponentWrapper("baseColor", [1, 1, 1]))
mat.getComponent("baseColor")?.setTexture({
    texCoord: "uv0",
    wrapper: new TextureWrapper(
        new ImageWrapper(
            new Uint8Array([
                255, 0, 0, 1,
                0, 255, 0, 1,
                0, 0, 255, 1,
            ]).buffer,
            3,
            1,
            "rgba8unorm"
        ),
        new SamplerWrapper("linear", "linear", "linear", "repeat", "repeat")
    )
})

const mat2 = new MaterialWrapper("opaque", 0, false)
mat2.setComponent(new MaterialComponentWrapper("baseColor", [1, 1, 1]))
mat2.getComponent("baseColor")?.setTexture({
    texCoord: "uv0",
    wrapper: new TextureWrapper(
        new ImageWrapper(
            new Uint8Array([
                1, 0, 0, 1,
                120, 0, 0, 1,
                0, 0, 255, 1,
            ]).buffer,
            3,
            1,
            "rgba8unorm"
        ),
        new SamplerWrapper("linear", "linear", "linear", "repeat", "repeat")
    )
})



const primitive = new PrimitiveWrapper(mat, geo)
const primitive2 = new PrimitiveWrapper(mat2, geo)
const mesh = new MeshWrapper()
const mesh2 = new MeshWrapper()
mesh2.setPrimitive(primitive2)
mesh.setPrimitive(primitive)
const nd = new NodeWrapper()
nd.setMesh(mesh)

const nd2 = new NodeWrapper()
nd2.setMesh(mesh2)
nd2.setTranslation(.5, 0, 0.01)

scene.addNode(nd)
scene.addNode(nd2)

function frame(): void {

    renderer.render(scene, camera)
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);