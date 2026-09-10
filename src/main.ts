import {GPUContext} from "./engine/gpu-context.ts";

import {GeometryWrapper} from "./engine/wrappers/GeometryWrapper.ts";
import {VertexAttributeWrapper} from "./engine/wrappers/VertexAttributeWrapper.ts";
import {MaterialWrapper} from "./engine/wrappers/MaterialWrapper.ts";
import {MaterialComponentWrapper} from "./engine/wrappers/MaterialComponentWrapper.ts";
import {PrimitiveWrapper} from "./engine/wrappers/PrimitiveWrapper.ts";
import {MaterialDescriptorProducer} from "./engine/descriptorProducer/MaterialDescriptorProducer.ts";
import {GeometryDescriptorProducer} from "./engine/descriptorProducer/GeometryDescriptorProducer.ts";
import {Hasher} from "./engine/hashing/Hasher.ts";
import {ShaderDescriptorProducer} from "./engine/descriptorProducer/ShaderDescriptorProducer.ts";
import {BindGroupLayoutManager} from "./engine/managers/BindGroupLayoutManager.ts";
import {BufferManager} from "./engine/managers/BufferManager.ts";
import {SamplerManager} from "./engine/managers/SamplerManager.ts";
import {TextureManager} from "./engine/managers/TextureManager.ts";
import {BindGroupManager} from "./engine/managers/BindGroupManager.ts";
import {PipelineLayoutManager} from "./engine/managers/PipelineLayoutManager.ts";
import {PipelineManager} from "./engine/managers/PipelineManager.ts";
import {ShaderModuleManager} from "./engine/managers/ShaderModuleManager.ts";

const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;

const gpu = await GPUContext.create(canvas);

let depthTexture: null | GPUTexture = null;
const device = gpu.device;
const format = gpu.format;
const context = gpu.context

gpu.onResize((w, h) => {
    depthTexture?.destroy();
    depthTexture = device.createTexture({
        size: [w, h],
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        format: "depth32float"
    })
})

gpu.resize(canvas.width, canvas.height)


// Scene uniform buffer (208 bytes)
const sceneBufferData = new Float32Array(52); // 208 bytes / 4 bytes per float
// Example scene data (adjust layout as needed)
sceneBufferData.set([
    // Projection matrix (16 floats)
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
    // View matrix (16 floats)
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
]);

// Node uniform buffer (64 bytes)
const nodeBufferData = new Float32Array(16); // 64 bytes / 4 bytes per float
// Example node data
nodeBufferData.set([
    // Model matrix (16 floats)
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
]);

// Create the buffers
const sceneBuffer = device.createBuffer({
    size: sceneBufferData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
});
new Float32Array(sceneBuffer.getMappedRange()).set(sceneBufferData);
sceneBuffer.unmap();

const nodeBuffer = device.createBuffer({
    size: nodeBufferData.byteLength, // 64 bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
});
new Float32Array(nodeBuffer.getMappedRange()).set(nodeBufferData);
nodeBuffer.unmap();

// Create bind group layouts
const sceneBindGroupLayout = device.createBindGroupLayout(BindGroupLayoutManager.SCENE_LAYOUT_DESCRIPTOR);
const nodeBindGroupLayout = device.createBindGroupLayout(BindGroupLayoutManager.NODE_LAYOUT_DESCRIPTOR);

// Create bind groups
const sceneBindGroup = device.createBindGroup({
    layout: sceneBindGroupLayout,
    entries: [
        {
            binding: 0,
            resource: {
                buffer: sceneBuffer,
            },
        },
    ],
});

const nodeBindGroup = device.createBindGroup({
    layout: nodeBindGroupLayout,
    entries: [
        {
            binding: 0,
            resource: {
                buffer: nodeBuffer,
            },
        },
    ],
});

const vertexData = new Float32Array([
    -0.5, -0.5, 0.0,
    0.5, -0.5, 0.0,
    0.0, 0.5, 0.0,
]);

const hasher = await Hasher.create();
const posAttr = new VertexAttributeWrapper("position", vertexData.buffer, "float32x3");

const bufferManager = new BufferManager(device, hasher);
const samplerManager = new SamplerManager(device, hasher);
const textureManager = new TextureManager(device, hasher);
const bindgroupLayoutManager = new BindGroupLayoutManager(device, hasher)
const bindgroupManager = new BindGroupManager(device, hasher)
const pipelineLayoutManager = new PipelineLayoutManager(device, hasher)
const pipelineManager = new PipelineManager(device, hasher)
const shaderModuleManager = new ShaderModuleManager(device, hasher)


const geo = new GeometryWrapper()
geo.addAttribute(posAttr)
const mat = new MaterialWrapper("opaque", 0.2, false);
const baseColor = new MaterialComponentWrapper("baseColor", [1, 0, 0])
const baseColor2 = new MaterialComponentWrapper("baseColor2", [1, 1, 0])
mat.setComponent(baseColor)
const primitive = new PrimitiveWrapper()
primitive.setMaterial(mat)
primitive.setGeometry(geo);
console.log(mat)
MaterialDescriptorProducer.produce(mat, hasher, 2)
GeometryDescriptorProducer.produce(geo)
ShaderDescriptorProducer.produce(primitive)
primitive.getVertexAssembler().assemble(primitive)
primitive.getFragmentAssembler().assemble(primitive)

let matBindgroupTracker = bindgroupManager.createOrGetFromMaterial(mat, bindgroupLayoutManager, textureManager, samplerManager, bufferManager);
let pipelineTracker = pipelineManager.createOrGetFromPipeline(primitive, bindgroupLayoutManager, pipelineLayoutManager, shaderModuleManager)
const attr = bufferManager.createOrGetVertexBuffer(posAttr).raw;

window.addEventListener("click", () => {
    baseColor.setFactors([0, 0, 0])
    mat.removeComponent(baseColor2)
    bindgroupManager.createOrGetFromMaterial(mat, bindgroupLayoutManager, textureManager, samplerManager, bufferManager);
})

window.addEventListener("contextmenu", () => {
    baseColor.setFactors([0, 0, 1])
    mat.setComponent(baseColor2)
    bindgroupManager.createOrGetFromMaterial(mat, bindgroupLayoutManager, textureManager, samplerManager, bufferManager);
})

function frame(): void {

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                clearValue: {r: 0.043, g: 0.047, b: 0.063, a: 1},
                loadOp: "clear",
                storeOp: "store",
            },
        ],
    });

    pass.setPipeline(pipelineTracker.raw);
    pass.setBindGroup(0, sceneBindGroup);
    pass.setBindGroup(1, matBindgroupTracker.raw);
    pass.setBindGroup(2, nodeBindGroup);
    pass.setVertexBuffer(0, attr)
    pass.draw(3)
    pass.end();


    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);