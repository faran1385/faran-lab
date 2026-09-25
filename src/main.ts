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
import {PerspectiveCamera} from "./engine/Camera/PerspectiveCamera.ts";
import {Scene} from "./engine/Scene/Scene.ts";

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


const scene = new Scene();

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

const producer = new DescriptorProducer();
const primitive = new PrimitiveWrapper(mat, geo)
const mesh = new MeshWrapper()
mesh.setPrimitive(primitive)
const nd = new NodeWrapper()
nd.setMesh(mesh)

const nd2 = new NodeWrapper()
nd2.setMesh(mesh)
nd2.setTranslation(2, 0, 0)

scene.addNode(nd)
scene.addNode(nd2)


window.addEventListener("click",()=>{

})

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


    scene.traverse((node) => {
        bufferManager.ensure(node.uuid, () => producer.produceBufferFromNodeMatrix(node));
        bindgroupManager.ensure(node.uuid, () => producer.produceBindgroupFromNode({
            layouts: bindgroupLayoutManager,
            buffers: bufferManager,
            node
        }));
    })

    scene.updateWorldMatrices(bufferManager.upload.bind(bufferManager));

    scene.traverse((node) => {

        if (node.getMesh()) {
            node.getMesh()!.getAllPrimitives().forEach((p) => {
                if (p.getMaterial().needsShaderRebuild(hasher)) {
                    p.getPipeline().markVertexShaderDirty()
                    p.getPipeline().markFragmentShaderDirty()
                    p.getMaterial().syncShaderRebuild()
                }

                if (p.getPipeline().getVertexShaderWrapper().codeGenVersionFlag.needsUpdate()) {
                    const entryPoint = "main"
                    const code = p.getVertexAssembler().assemble(producer.produceVertexShader({
                        geometry: p.getGeometry(),
                        material: p.getMaterial(),
                    }), entryPoint)
                    p.getPipeline().getVertexShaderWrapper().setShader(code, entryPoint)
                    p.getPipeline().getVertexShaderWrapper().codeGenVersionFlag.sync()
                }

                if (p.getPipeline().getFragmentShaderWrapper().codeGenVersionFlag.needsUpdate()) {
                    const entryPoint = "main"
                    const code = p.getFragmentAssembler().assemble(producer.produceFragmentShader({
                        geometry: p.getGeometry(),
                        vertexShader: p.getPipeline().getVertexShaderWrapper(),
                        material: p.getMaterial()
                    }), entryPoint)
                    p.getPipeline().getFragmentShaderWrapper().setShader(code, entryPoint)
                    p.getPipeline().getFragmentShaderWrapper().codeGenVersionFlag.sync()
                }
                geo.getAttributes().forEach(attribute => {
                    bufferManager.ensure(attribute.convertToHash(hasher), () => producer.produceBuffer(attribute))
                })

                bufferManager.ensure(p.getMaterial().convertToFactorsHash(hasher), () => producer.produceBufferFromMatFactors(p.getMaterial()))
                shaderModuleManager.ensure(p.getPipeline().getVertexShaderWrapper().convertToHash(hasher), () => producer.produceShaderModule(p.getPipeline().getVertexShaderWrapper()))
                shaderModuleManager.ensure(p.getPipeline().getFragmentShaderWrapper().convertToHash(hasher), () => producer.produceShaderModule(p.getPipeline().getFragmentShaderWrapper()))

                p.getMaterial().getAllComponents().forEach(component => {

                    if (component.getTexture()) {
                        samplerManager.ensure(component.getTexture()!.wrapper.getSampler().convertToHash(hasher), () => producer.produceSampler(component.getTexture()!.wrapper.getSampler()))
                        textureManager.ensure(component.getTexture()!.wrapper.getImage().convertToHash(hasher), () => producer.produceTexture(component.getTexture()!.wrapper.getImage()))
                    }

                    if (component.needsFactorUpdate()) {
                        const plan = producer.getFactorPlan(p.getMaterial())
                        const item = plan.get(component.name)!

                        bufferManager.upload(p.getMaterial().convertToFactorsHash(hasher), new Float32Array([item.factor].flat()), item.offset)
                        component.syncFactorUpdate()
                    }
                })

                bindgroupLayoutManager.ensure(p.getMaterial().convertToBindgroupLayoutHash(hasher), () => producer.produceBindGroupLayout(p.getMaterial()))
                bindgroupManager.ensure(p.getMaterial().convertToBindgroupHash(hasher), () => producer.produceBindGroup({
                    material: p.getMaterial(),
                    samplers: samplerManager,
                    hasher: hasher,
                    buffers: bufferManager,
                    layouts: bindgroupLayoutManager,
                    textures: textureManager,
                }))
                pipelineLayoutManager.ensure(p.getMaterial().convertToBindgroupLayoutHash(hasher), () => producer.producePipelineLayout({
                    material: p.getMaterial(),
                    hasher: hasher,
                    layouts: bindgroupLayoutManager
                }))
                p.getPipeline().setInputs(
                    p.getPipeline().getVertexShaderWrapper().convertToHash(hasher),
                    p.getPipeline().getFragmentShaderWrapper().convertToHash(hasher),
                    p.getMaterial().convertToBindgroupLayoutHash(hasher),
                    p.getGeometry().convertToAttributesHash(hasher),
                    p.getMaterial().convertToPipelineSettingsHash(hasher),
                    "back"
                )
                pipelineManager.ensure(p.getPipeline().convertToHash(hasher), () => producer.producePipeline({
                    frame: {
                        sampleCount: 1,
                        colorFormat: "bgra8unorm",
                        depthFormat: "depth32float"
                    },
                    hasher: hasher,
                    geometry: p.getGeometry(),
                    material: p.getMaterial(),
                    pipelineLayouts: pipelineLayoutManager,
                    pipeline: p.getPipeline(),
                    shaderModules: shaderModuleManager
                }))

                pass.setPipeline(pipelineManager.getRaw(p.getPipeline().convertToHash(hasher)))
                pass.setBindGroup(0, bindgroupManager.getRaw(camera.uuid))
                pass.setBindGroup(1, bindgroupManager.getRaw(primitive.getMaterial().convertToBindgroupHash(hasher)))
                pass.setBindGroup(2, bindgroupManager.getRaw(node.uuid))
                pass.setVertexBuffer(0, bufferManager.getRaw(posAttr.convertToHash(hasher)))
                pass.setVertexBuffer(1, bufferManager.getRaw(uvAttr.convertToHash(hasher)))

                pass.draw(3)
                console.log(node)
            })

        }
    })

    pass.end();
    device.queue.submit([encoder.finish()]);

    producer.clear()
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);