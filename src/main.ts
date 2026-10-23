import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";
import {Scene} from "./engine/Scene/Scene.ts";
import {Renderer} from "./engine/Renderer/Renderer.ts";
import * as Stats from "stats.js";

import {ImageWrapper} from "./engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "./engine/wrappers/SamplerWrapper.ts";
import {TextureWrapper} from "./engine/wrappers/TextureWrapper.ts";
import {MaterialComponentWrapper} from "./engine/wrappers/MaterialComponentWrapper.ts";
import {MaterialWrapper} from "./engine/wrappers/MaterialWrapper.ts";
import {GeometryWrapper} from "./engine/wrappers/GeometryWrapper.ts";
import {AttributeWrapper} from "./engine/wrappers/AttributeWrapper.ts";
import {PrimitiveWrapper} from "./engine/wrappers/PrimitiveWrapper.ts";
import {MeshWrapper} from "./engine/wrappers/MeshWrapper.ts";
import {NodeWrapper} from "./engine/wrappers/NodeWrapper.ts";

// --------------------------------------------------
// Canvas and renderer
// --------------------------------------------------

const canvas = document.querySelector("canvas");

if (!canvas) {
    throw new Error("No canvas element found.");
}

const stats = new Stats.default();
document.body.appendChild(stats.dom);

const renderer = new Renderer(canvas);
const scene = new Scene();

const camera = new PerspectiveCamera(
    45,
    canvas.width / canvas.height,
    0.1,
    100,
);

camera.setPosition(0, 0, 3);

await renderer.init();

function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer.setSize(width, height);

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    camera.setAspect(width / height);
}

window.addEventListener("resize", resize);
resize();

// --------------------------------------------------
// Checkerboard image
// --------------------------------------------------

function makeCheckerImage(): ImageWrapper {
    const size = 16;
    const pixels = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const value = (x + y) % 2 === 0 ? 255 : 0;
            const offset = (y * size + x) * 4;

            pixels[offset] = value;
            pixels[offset + 1] = value;
            pixels[offset + 2] = value;
            pixels[offset + 3] = 255;
        }
    }

    return new ImageWrapper(pixels.buffer, size, size);
}

// --------------------------------------------------
// Samplers
// --------------------------------------------------

// Small checker squares repeat across the surface.
const repeatNearest = new SamplerWrapper(
    "nearest", // min filter
    "nearest", // mag filter
    "nearest", // mip filter
    "repeat",  // U
    "repeat",  // V
);

// Coordinates outside [0, 1] clamp to the texture edges.
const clampLinear = new SamplerWrapper(
    "linear",
    "linear",
    "nearest",
    "clamp-to-edge",
    "clamp-to-edge",
);

const checkerImage = makeCheckerImage();
const texture = new TextureWrapper(checkerImage, repeatNearest);

// --------------------------------------------------
// Material
// --------------------------------------------------

const material = new MaterialWrapper();

const baseColor = new MaterialComponentWrapper(
    "baseColor",
    [1, 1, 1],
);

baseColor.setTexture({
    texCoord: "uv0",
    wrapper: texture,
});

material.setComponent(baseColor);

// --------------------------------------------------
// Triangle geometry
// --------------------------------------------------

const positions = new AttributeWrapper(
    "position",
    new Float32Array([
        -1.0, -1.0, 0.0,
        1.0, -1.0, 0.0,
        0.0, 1.0, 0.0,
    ]).buffer,
    "float32x3",
);

// UVs intentionally extend well beyond the [0, 1] range.
// This makes repeat vs clamp visibly different.
const uvs = new AttributeWrapper(
    "uv0",
    new Float32Array([
        -4.0, 8.0,
        8.0, 8.0,
        2.0, -4.0,
    ]).buffer,
    "float32x2",
);

const geometry = new GeometryWrapper();
geometry.setAttribute(positions);
geometry.setAttribute(uvs);

const primitive = new PrimitiveWrapper(material, geometry);
const mesh = new MeshWrapper();
mesh.setPrimitive(primitive)

const node = new NodeWrapper();
node.setMesh(mesh)
scene.addNode(node);

// --------------------------------------------------
// Interactive sampler test
// --------------------------------------------------

let useClampLinear = false;

canvas.style.cursor = "pointer";

canvas.addEventListener("click", () => {
    useClampLinear = !useClampLinear;

    if (useClampLinear) {
        texture.setSampler(clampLinear);
        console.log(
            "[Sampler Test] LINEAR + CLAMP TO EDGE",
            texture.getSampler(),
        );
    } else {
        texture.setSampler(repeatNearest);
        console.log(
            "[Sampler Test] NEAREST + REPEAT",
            texture.getSampler(),
        );
    }
});

// --------------------------------------------------
// Render loop
// --------------------------------------------------

function frame() {
    stats.begin();

    renderer.render(scene, camera);

    stats.end();

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

console.log(
    "[Sampler Test] Initial sampler: NEAREST + REPEAT. Click the canvas to toggle.",
);