import {GPUContext} from "./engine/gpu-context.ts";

import {GeometryWrapper} from "./engine/wrappers/GeometryWrapper.ts";
import {AttributeWrapper} from "./engine/wrappers/AttributeWrapper.ts";
import {MaterialWrapper} from "./engine/wrappers/MaterialWrapper.ts";
import {PrimitiveWrapper} from "./engine/wrappers/PrimitiveWrapper.ts";
import {Hasher} from "./engine/hashing/Hasher.ts";
import {BindGroupLayoutManager} from "./engine/managers/BindGroupLayoutManager.ts";
import {BufferManager} from "./engine/managers/BufferManager.ts";
import {SamplerManager} from "./engine/managers/SamplerManager.ts";
import {TextureManager} from "./engine/managers/TextureManager.ts";
import {BindGroupManager} from "./engine/managers/BindGroupManager.ts";
import {PipelineLayoutManager} from "./engine/managers/PipelineLayoutManager.ts";
import {PipelineManager} from "./engine/managers/PipelineManager.ts";
import {ShaderModuleManager} from "./engine/managers/ShaderModuleManager.ts";
import {MeshWrapper} from "./engine/wrappers/MeshWrapper.ts";
import {NodeWrapper} from "./engine/wrappers/NodeWrapper.ts";
import {DescriptorProducer} from "./engine/producers/CentralProducer.ts";
import {MaterialComponentWrapper} from "./engine/wrappers/MaterialComponentWrapper.ts";
import {TextureWrapper} from "./engine/wrappers/TextureWrapper.ts";
import {ImageWrapper} from "./engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "./engine/wrappers/SamplerWrapper.ts";
import {mat4} from "./packages/math/matrix/mat4.ts";
import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";

const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;

const gpu = await GPUContext.create(canvas);

let depthTexture: null | GPUTexture = null;
const device = gpu.device;
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

const bufferManager = new BufferManager(device);
const shaderModuleManager = new ShaderModuleManager(device);
const samplerManager = new SamplerManager(device);
const textureManager = new TextureManager(device);
const pipelineLayoutManager = new PipelineLayoutManager(device);
const bindgroupManager = new BindGroupManager(device);
const pipelineManager = new PipelineManager(device);
const bindgroupLayoutManager = new BindGroupLayoutManager(device);


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

const hasher = await Hasher.create();
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
                255, 0, 0, 1,   // texel 0: RED
                0, 255, 0, 1,   // texel 1: GREEN
                0, 0, 255, 1,   // texel 2: BLUE
            ]).buffer,
            3,   // width  = 3 texels
            1,
            "rgba8unorm"
        ),
        new SamplerWrapper("linear", "linear", "linear", "repeat", "repeat")
    )
})

const producer = new DescriptorProducer();
const primitive = new PrimitiveWrapper(mat, geo)
const mesh = new MeshWrapper()
mesh.setPrimitive(primitive)
const node = new NodeWrapper()
node.setMesh(mesh)



function frame(): void {

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                loadOp: "clear",
                clearValue: [1, 1, 1, 1],
                storeOp: "store",
            },
        ],
    });

    // global
    bufferManager.ensure(camera.uuid, () => producer.produceCameraBuffer(camera))
    if (camera.isUploadViewDirty()) {
        bufferManager.upload(camera.uuid, camera.getViewMatrix().buffer, 0)
        camera.syncUploadView()
    }
    if (camera.isUploadProjectionDirty()) {
        bufferManager.upload(camera.uuid, camera.getProjectionMatrix().buffer, 64)
        camera.syncUploadProjection()
    }
    // hash should change as we add items
    bindgroupManager.ensure(camera.uuid, () => producer.produceSceneBindgroup({
        layouts: bindgroupLayoutManager,
        camera,
        buffers: bufferManager
    }))

    // mesh
    if (mat.needsShaderRebuild(hasher)) {
        primitive.getPipeline().markVertexShaderDirty()
        primitive.getPipeline().markFragmentShaderDirty()
        mat.syncShaderRebuild()
    }

    if (primitive.getPipeline().getVertexShaderWrapper().codeGenVersionFlag.needsUpdate()) {
        const entryPoint = "main"
        const code = primitive.getVertexAssembler().assemble(producer.produceVertexShader({
            geometry: primitive.getGeometry(),
            material: primitive.getMaterial(),
        }), entryPoint)
        primitive.getPipeline().getVertexShaderWrapper().setShader(code, entryPoint)
        primitive.getPipeline().getVertexShaderWrapper().codeGenVersionFlag.sync()
    }

    if (primitive.getPipeline().getFragmentShaderWrapper().codeGenVersionFlag.needsUpdate()) {
        const entryPoint = "main"
        const code = primitive.getFragmentAssembler().assemble(producer.produceFragmentShader({
            geometry: primitive.getGeometry(),
            vertexShader: primitive.getPipeline().getVertexShaderWrapper(),
            material: primitive.getMaterial()
        }), entryPoint)
        console.log(code)
        primitive.getPipeline().getFragmentShaderWrapper().setShader(code, entryPoint)
        primitive.getPipeline().getFragmentShaderWrapper().codeGenVersionFlag.sync()
    }
    geo.getAttributes().forEach(attribute => {
        bufferManager.ensure(attribute.convertToHash(hasher), () => producer.produceBuffer(attribute))
    })

    bufferManager.ensure(mat.convertToFactorsHash(hasher), () => producer.produceBufferFromMatFactors(mat))
    shaderModuleManager.ensure(primitive.getPipeline().getVertexShaderWrapper().convertToHash(hasher), () => producer.produceShaderModule(primitive.getPipeline().getVertexShaderWrapper()))
    shaderModuleManager.ensure(primitive.getPipeline().getFragmentShaderWrapper().convertToHash(hasher), () => producer.produceShaderModule(primitive.getPipeline().getFragmentShaderWrapper()))

    mat.getAllComponents().forEach(component => {

        if (component.getTexture()) {
            samplerManager.ensure(component.getTexture()!.wrapper.getSampler().convertToHash(hasher), () => producer.produceSampler(component.getTexture()!.wrapper.getSampler()))
            textureManager.ensure(component.getTexture()!.wrapper.getImage().convertToHash(hasher), () => producer.produceTexture(component.getTexture()!.wrapper.getImage()))
        }

        if (component.needsFactorUpdate()) {
            const plan = producer.getFactorPlan(mat)
            const item = plan.get(component.name)!

            bufferManager.upload(mat.convertToFactorsHash(hasher), new Float32Array([item.factor].flat()), item.offset)
            component.syncFactorUpdate()
        }
    })

    bindgroupLayoutManager.ensure(mat.convertToBindgroupLayoutHash(hasher), () => producer.produceBindGroupLayout(mat))
    bindgroupManager.ensure(mat.convertToBindgroupHash(hasher), () => producer.produceBindGroup({
        material: mat,
        samplers: samplerManager,
        hasher: hasher,
        buffers: bufferManager,
        layouts: bindgroupLayoutManager,
        textures: textureManager,
    }))
    pipelineLayoutManager.ensure(mat.convertToBindgroupLayoutHash(hasher), () => producer.producePipelineLayout({
        material: mat,
        hasher: hasher,
        layouts: bindgroupLayoutManager
    }))
    primitive.getPipeline().setInputs(
        primitive.getPipeline().getVertexShaderWrapper().convertToHash(hasher),
        primitive.getPipeline().getFragmentShaderWrapper().convertToHash(hasher),
        mat.convertToBindgroupLayoutHash(hasher),
        geo.convertToAttributesHash(hasher),
        mat.convertToPipelineSettingsHash(hasher),
        "back"
    )
    pipelineManager.ensure(primitive.getPipeline().convertToHash(hasher), () => producer.producePipeline({
        frame: {
            sampleCount: 1,
            colorFormat: "bgra8unorm",
            depthFormat: "depth32float"
        },
        hasher: hasher,
        geometry: geo,
        material: mat,
        pipelineLayouts: pipelineLayoutManager,
        pipeline: primitive.getPipeline(),
        shaderModules: shaderModuleManager
    }))

    /// node
    bufferManager.ensure(node.uuid, () => producer.produceBufferFromNodeMatrix(node));
    bindgroupManager.ensure(node.uuid, () => producer.produceBindgroupFromNode({
        layouts: bindgroupLayoutManager,
        buffers: bufferManager,
        node
    }));

    if (node.isTransformDirty()) {
        console.log(node.isTransformDirty())
        node.buildWorldMatrix(mat4.create(), bufferManager.upload.bind(bufferManager))
    }

    pass.setPipeline(pipelineManager.getRaw(primitive.getPipeline().convertToHash(hasher)))
    pass.setBindGroup(0, bindgroupManager.getRaw(camera.uuid))
    pass.setBindGroup(1, bindgroupManager.getRaw(mat.convertToBindgroupHash(hasher)))
    pass.setBindGroup(2, bindgroupManager.getRaw(node.uuid))
    pass.setVertexBuffer(0, bufferManager.getRaw(posAttr.convertToHash(hasher)))
    pass.setVertexBuffer(1, bufferManager.getRaw(uvAttr.convertToHash(hasher)))

    pass.draw(3)

    pass.end();

    device.queue.submit([encoder.finish()]);

    producer.clear()
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);