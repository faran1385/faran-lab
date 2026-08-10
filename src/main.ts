import shaderCode from "./shader.wgsl?raw";
import {cubeVertices, cubeVertexStride, faceNormals} from "./geometry";
import {mat4} from "./packages/math/matrix/mat4.ts";
import {vec3} from "./packages/math/vector/vec3.ts";
import {GPUContext} from "./engine/gpu-context.ts";
import {GLBLoader} from "./engine/loaders/GLBLoader.ts";
import {GLTFImporter} from "./engine/importers/GLTFImporter.ts";
import {ImportFromGLB} from "./engine/importers/utils/GLBAdapter.ts";
import {IRToWrapperConvertor} from "./engine/importers/utils/IRToWrapperConvertor.ts";
import {BaseWireUp} from "./engine/WireUp/BaseWireUp.ts";
import {MaterialDescriptorProducer} from "./engine/descriptorProducer/MaterialDescriptorProducer.ts";
import {Hasher} from "./engine/hashing/Hasher.ts";

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


// --- geometry buffers ---
const vertexBuffer = device.createBuffer({
    size: cubeVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, cubeVertices);

const faceNormalBuffer = device.createBuffer({
    label: "faceNormals",
    size: faceNormals.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
})

device.queue.writeBuffer(faceNormalBuffer, 0, faceNormals);

// --- MVP uniform buffer (one 4x4 matrix = 64 bytes) ---
const modelBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const modelMat = mat4.fromValues(
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
)

// const R = mat4.fromMat3(mat4.create(), , .1)))

// mat4.mul(modelMat, modelMat, R);


const viewBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const viewMatrix = mat4.lookAt(
    mat4.create(),
    vec3.fromValues(0, 0, 10),
    vec3.fromValues(0, 0, 0),
    vec3.fromValues(0, 1, 0),
)

device.queue.writeBuffer(viewBuffer, 0, viewMatrix);

const projectionBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const projectionMat = mat4.perspective(
    mat4.create(),
    window.innerWidth / window.innerHeight,
    45,
    0.1,
    100
)

device.queue.writeBuffer(projectionBuffer, 0, projectionMat);

const bindGroupLayout = device.createBindGroupLayout({
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: {type: "uniform"},
        },
        {
            binding: 1,
            visibility: GPUShaderStage.VERTEX,
            buffer: {type: "uniform"},
        }
        ,
        {
            binding: 2,
            visibility: GPUShaderStage.VERTEX,
            buffer: {type: "uniform"},
        }
    ],
});

const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
        {
            binding: 0,
            resource: {buffer: modelBuffer}
        },
        {
            binding: 1,
            resource: {buffer: viewBuffer}
        },
        {
            binding: 2,
            resource: {buffer: projectionBuffer}
        },
    ],
});

const shaderModule = device.createShaderModule({code: shaderCode});

const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({bindGroupLayouts: [bindGroupLayout]}),
    vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [
            {
                arrayStride: cubeVertexStride,
                attributes: [
                    {shaderLocation: 0, offset: 0, format: "float32x3"}, // position
                    {shaderLocation: 1, offset: 3 * 4, format: "float32x3"}, // color
                ],
            },
            {
                arrayStride: 3 * 4,
                attributes: [
                    {shaderLocation: 2, offset: 0, format: "float32x3"}, // face normal
                ],
            },
        ],
    },
    fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{format}],
    },
    primitive: {
        topology: "triangle-list",
    },
    depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth32float"
    }
});

let last = performance.now() / 1000;
let delta = 0;

const glbLoader = new GLBLoader();
const glbImporter = new GLTFImporter();
const irToWrapperConvertor = new IRToWrapperConvertor();
const baseWireUp = new BaseWireUp();
const glbParseResult = await glbLoader.load("/test.glb")
const ir = await glbImporter.import(ImportFromGLB(glbParseResult))
const {materials} = irToWrapperConvertor.convert(ir, baseWireUp.wireUp.bind(baseWireUp));
const hasher = await Hasher.create();

materials.forEach(material => {
    console.log(MaterialDescriptorProducer.produce(material.wrapper, hasher, 2))
})


function frame(): void {
    delta = performance.now() / 1000 - last;
    last = performance.now() / 1000;


    device.queue.writeBuffer(modelBuffer, 0, modelMat);

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
        depthStencilAttachment: {
            depthLoadOp: "clear",
            depthClearValue: 1,
            depthStoreOp: "store",
            view: depthTexture?.createView(),
        }
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, faceNormalBuffer);
    pass.draw(36)
    pass.end();

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);