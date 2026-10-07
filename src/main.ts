import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";
import {Scene} from "./engine/Scene/Scene.ts";
import {Renderer} from "./engine/Renderer/Renderer.ts";
import * as Stats from "stats.js"
import {MaterialWrapper} from "./engine/wrappers/MaterialWrapper.ts";
import {GeometryWrapper} from "./engine/wrappers/GeometryWrapper.ts";
import {PrimitiveWrapper} from "./engine/wrappers/PrimitiveWrapper.ts";
import {MeshWrapper} from "./engine/wrappers/MeshWrapper.ts";
import {NodeWrapper} from "./engine/wrappers/NodeWrapper.ts";
import {AttributeWrapper} from "./engine/wrappers/AttributeWrapper.ts";
import {GLBLoader} from "./engine/loaders/GLBLoader.ts";
import {OrbitControls} from "./engine/Controls/OrbitControls.ts";
import {MaterialComponentWrapper} from "./engine/wrappers/MaterialComponentWrapper.ts";
import {FragmentAssemblerBase, type FragmentPhase2Output} from "./engine/Assemblers/BaseAssembler.ts";
import {BasicVertexAssembler} from "./engine/Assemblers/BasicAssembler/BasicAssembler.ts";
import {ImageWrapper} from "./engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "./engine/wrappers/SamplerWrapper.ts";
import {TextureWrapper} from "./engine/wrappers/TextureWrapper.ts";

const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;
let stats = new Stats.default();
stats.showPanel(1);
document.body.appendChild(stats.dom);

const loader = new GLBLoader();

// const {root} = await loader.load("/test.glb");


const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.setPosition(0, 0, 3)
const controls = new OrbitControls(camera, canvas, {enableDamping: true});


window.addEventListener("resize", () => {
    camera.setAspect(window.innerWidth / window.innerHeight)
    renderer.setSize(window.innerWidth, window.innerHeight)
})

const scene = new Scene();
const renderer = new Renderer(canvas);
await renderer.init()
renderer.setSize(window.innerWidth, window.innerHeight)

class AlphaCutoffProbeAssembler extends FragmentAssemblerBase {
    protected fragmentPhase2(
        _varyingValues: any,
        bindingValues: any,
        _components: any,
        _builtinValues: any,
    ): FragmentPhase2Output {
        const cutoff = bindingValues.get("alphaCutOff")!.access;

        return {
            body: `
                let v = ${cutoff};
                return FragmentOutput(vec4f(v, v, v, 1.0));
            `,
            usedBuiltins: [],
            expectedFromVertex: [],
            outputs: [{type: "vec4f", name: "color", location: 0}],
        };
    }
}

const mat = new MaterialWrapper({
    alphaCutoff: 0.8,
});

// Sorted order: c, d
//
// c = f32
// d = vec4f
//
// This layout ends up larger because d needs 16-byte alignment.
mat.setComponent(
    new MaterialComponentWrapper("c", [0])
);

mat.setComponent(
    new MaterialComponentWrapper("d", [1, 0, 1, 1])
);


const pa1 = new AttributeWrapper("position", new Float32Array([
    -0.5, -0.5, 0.0,
    0.5, -0.5, 0.0,
    0.0, 0.5, 0.0
]).buffer, "float32x3")

const geometry = new GeometryWrapper();
geometry.setAttribute(pa1);

const material = new MaterialWrapper();

const component = new MaterialComponentWrapper(
    "baseColor",
    [1, 1, 1, 1],
);

material.setComponent(component);

const before = material.hashProvider.convertToShaderHash(
    renderer.hasher
);

const image = new ImageWrapper(
    new Uint8Array([255, 255, 255, 255]).buffer,
    1,
    1,
);

const sampler = new SamplerWrapper();
const texture = new TextureWrapper(image, sampler);

component.setTexture({
    wrapper: texture,
    texCoord: "0",
});

const after = material.hashProvider.convertToShaderHash(
    renderer.hasher
);

console.log("shader hash before:", before);
console.log("shader hash after:", after);
console.log("changed:", before !== after);