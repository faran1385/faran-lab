import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";
import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";
import type {MaterialWrapper} from "../wrappers/MaterialWrapper.ts";
import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import type {MeshWrapper} from "../wrappers/MeshWrapper.ts";
import {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import type {TextureWrapper} from "../wrappers/TextureWrapper.ts";
import type {IndexAttributeWrapper} from "../wrappers/IndexWrapper.ts";
import type {VertexAttributeWrapper} from "../wrappers/VertexAttributeWrapper.ts";
import type {TextureRef} from "../importers/utils/IR.ts";
import type {MaterialComponentWrapper} from "../wrappers/MaterialComponentWrapper.ts";

type Geometries = {
    wrapper: GeometryWrapper,
    indexWrapper: IndexAttributeWrapper | null,
    attributes: VertexAttributeWrapper[]
}[]

export type NodeHierarchy = {
    wrapper: NodeWrapper,
    mesh?: number,
    children: NodeHierarchy[],
}

type Samplers = SamplerWrapper[]
type Images = ImageWrapper[]
type Materials = {
    wrapper: MaterialWrapper,
    components: { wrapper: MaterialComponentWrapper, textureRef?: TextureRef }[]
}[]
type Nodes = NodeHierarchy[]


type Primitives = {
    wrapper: PrimitiveWrapper
    geometry: number
    material: number
}[]

type Meshes = {
    wrapper: MeshWrapper
    primitives: number[]
}[]

type Textures = {
    wrapper: TextureWrapper
    sampler: number
    image: number
}[]

export type WireUpInput = {
    images: Images,
    materials: Materials,
    nodes: Nodes,
    primitives: Primitives,
    meshes: Meshes,
    textures: Textures,
    samplers: Samplers,
    geometries: Geometries,
}

export class BaseWireUp {
    constructor() {
    }

    private wireGeometries(T: WireUpInput["geometries"]) {
        T.forEach((item) => {
            item.attributes.forEach(attribute => {
                item.wrapper.addAttribute(attribute)
                if (item.indexWrapper) item.wrapper.setIndices(item.indexWrapper)
            })
        })
    }

    private wireMaterials(materials: WireUpInput["materials"], textures: WireUpInput["textures"]) {
        materials.forEach((item) => {
            item.components.forEach(component => {
                item.wrapper.setComponent(component.wrapper)

                if (component.textureRef) {
                    component.wrapper.setTexture({
                        wrapper: textures[component.textureRef.index].wrapper,
                        texCoord: component.textureRef.texCoord
                    })
                }
            })
        })
    }

    private wireTextures(textures: WireUpInput["textures"], samplersList: WireUpInput["samplers"], images: WireUpInput["images"]) {
        textures.forEach((item) => {
            item.wrapper.setImage(images[item.image])
            item.wrapper.setSampler(samplersList[item.sampler])
        })
    }

    private wirePrimitives(primitives: WireUpInput["primitives"], materials: WireUpInput["materials"], geometries: WireUpInput["geometries"]) {
        primitives.forEach((item) => {
            item.wrapper.setMaterial(materials[item.material].wrapper)
            item.wrapper.setGeometry(geometries[item.geometry].wrapper)
        })
    }

    private wireMeshes(meshes: WireUpInput["meshes"], primitives: WireUpInput["primitives"]) {
        meshes.forEach((item) => {
            item.primitives.forEach((index) => {
                item.wrapper.setPrimitive(primitives[index].wrapper)
            })
        })
    }

    private wireNode(nodeHierarchy: NodeHierarchy, meshes: WireUpInput["meshes"]) {

        if (nodeHierarchy.mesh !== undefined) {
            nodeHierarchy.wrapper.setMesh(meshes[nodeHierarchy.mesh].wrapper)
        }

        nodeHierarchy.children.forEach(child => {
            nodeHierarchy.wrapper.addChild(child.wrapper);
            this.wireNode(child, meshes);
        });
    }

    private wireNodes(nodes: WireUpInput["nodes"], meshes: WireUpInput["meshes"]) {
        nodes.forEach((item) => {
            this.wireNode(item, meshes)
        })
    }

    wireUp(T: WireUpInput) {
        this.wireGeometries(T.geometries)
        this.wireMaterials(T.materials, T.textures)
        this.wireTextures(T.textures, T.samplers, T.images)
        this.wirePrimitives(T.primitives, T.materials, T.geometries)
        this.wireMeshes(T.meshes, T.primitives)
        this.wireNodes(T.nodes, T.meshes)

    }
}