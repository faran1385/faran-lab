import type {
    Attribute, AttributeName, DecodedImage,
    Geometry,
    Material,
    Mesh,
    Node,
    Primitive,
    Sampler,
    SceneIR, Texture, TextureRef
} from "./IR.ts";
import {GeometryWrapper} from "../../wrappers/GeometryWrapper.ts";
import {SamplerWrapper} from "../../wrappers/SamplerWrapper.ts";
import {ImageWrapper} from "../../wrappers/ImageWrapper.ts";
import {MaterialWrapper} from "../../wrappers/MaterialWrapper.ts";
import {PrimitiveWrapper} from "../../wrappers/PrimitiveWrapper.ts";
import {MeshWrapper} from "../../wrappers/MeshWrapper.ts";
import {NodeWrapper} from "../../wrappers/NodeWrapper.ts";
import {TextureWrapper} from "../../wrappers/TextureWrapper.ts";
import type {NodeHierarchy, WireUpInput} from "../../WireUp/BaseWireUp.ts";
import {AttributeWrapper} from "../../wrappers/AttributeWrapper.ts";
import {IndexAttributeWrapper} from "../../wrappers/IndexWrapper.ts";
import {MaterialComponentWrapper} from "../../wrappers/MaterialComponentWrapper.ts";


export class IRToWrapperConvertor {

    private static defaultSampler = new SamplerWrapper("linear", "linear", "linear", "repeat", "repeat")

    constructor() {
    }

    createVertexAttributeWrapper(name: AttributeName, attr: Attribute) {
        return new AttributeWrapper(name, attr.data, attr.format);
    }

    createGeometryWrapper() {
        return new GeometryWrapper();
    }

    createIndexWrapper(data: IndexAttributeWrapper["data"], format: IndexAttributeWrapper["format"]) {
        return new IndexAttributeWrapper(data, format);
    }

    private convertGeos(geoList: Geometry[], attributes: Attribute[]) {

        return geoList.map((item) => {
            const attributeWrapperList: AttributeWrapper[] = [];
            for (let key in item.attributes) {
                attributeWrapperList.push(this.createVertexAttributeWrapper(key as AttributeName, attributes[item.attributes[key as AttributeName]]));
            }

            return {
                wrapper: this.createGeometryWrapper(),
                indexWrapper: item.indices ? this.createIndexWrapper(item.indices.data, item.indices.format) : null,
                attributes: attributeWrapperList,
            }
        })
    }


    createSamplerWrapper(
        minFilter: Sampler["minFilter"],
        magFilter: Sampler["magFilter"],
        mipFilter: Sampler["mipFilter"],
        addressModeU: Sampler["addressModeU"],
        addressModeV: Sampler["addressModeV"]
    ) {
        return new SamplerWrapper(minFilter, magFilter, mipFilter, addressModeU, addressModeV)
    }

    createImageWrapper(data: ArrayBuffer, width: number, height: number) {
        return new ImageWrapper(data, width, height);
    }

    createMaterialWrapper(
        alphaMode: Material["alphaMode"],
        alphaCutoff: Material["alphaCutoff"],
        doubleSided: Material["doubleSided"]
    ) {
        return new MaterialWrapper(alphaMode, alphaCutoff, doubleSided)
    }

    createPrimitiveWrapper(topology: Primitive["topology"]) {
        const primitive = new PrimitiveWrapper();
        primitive.getPipeline().setTopology(topology);

        return primitive
    }

    createNodeWrapper(
        translation: Node["translation"],
        rotation: Node["rotation"],
        scale: Node["scale"],
        name?: string,
    ) {
        return new NodeWrapper(translation, rotation, scale, name);
    }

    createTextureWrapper() {
        return new TextureWrapper()
    }

    private convertSamplers(samplers: Sampler[]) {
        return samplers.map((sampler: Sampler) => {
            return this.createSamplerWrapper(
                sampler.minFilter,
                sampler.magFilter,
                sampler.mipFilter,
                sampler.addressModeU,
                sampler.addressModeV,
            )
        })
    }

    private convertImages(images: DecodedImage[]) {
        return images.map((item) => {
            return this.createImageWrapper(item.data, item.width, item.height)
        })
    }

    private createMaterialComponentWrapper(name: string, factors: number[]) {
        return new MaterialComponentWrapper(name, factors)
    }

    private convertMaterials(materials: Material[]) {
        return materials.map((mat) => {

            const components: {
                wrapper: MaterialComponentWrapper,
                textureRef?: TextureRef
            }[] = []

            for (let key in mat.components) {
                const item = mat.components[key];

                components.push({
                    wrapper: this.createMaterialComponentWrapper(key, item.factor),
                    textureRef: item.texture
                })
            }

            return {
                wrapper: this.createMaterialWrapper(mat.alphaMode, mat.alphaCutoff, mat.doubleSided),
                components,
            }
        })
    }

    private convertPrimitives(primitives: Primitive[]) {
        return primitives.map((item) => {
            return {
                wrapper: this.createPrimitiveWrapper(item.topology),
                geometry: item.geometry,
                material: item.material,
            }
        })
    }

    private convertMeshes(meshes: Mesh[]) {
        return meshes.map((item) => {
            return {
                wrapper: new MeshWrapper(),
                primitives: item.primitives
            }
        })
    }


    private traverseNodes(node: Node): NodeHierarchy {
        const wrapper = this.createNodeWrapper(
            node.translation,
            node.rotation,
            node.scale,
            node.name,
        );

        return {
            wrapper,
            mesh: node.mesh,
            children: node.children.map(child => this.traverseNodes(child)),
        };
    }

    private convertNodes(nodes: Node[]): NodeHierarchy[] {
        return nodes.map(node => this.traverseNodes(node));
    }

    private convertTexture(textures: Texture[], samplers: SamplerWrapper[]) {
        let isAlreadyAssigned = false;
        return textures.map(item => {

            if (item.sampler === undefined && !isAlreadyAssigned) {
                samplers.push(IRToWrapperConvertor.defaultSampler)
            }

            return {
                wrapper: this.createTextureWrapper(),
                sampler: item.sampler ?? samplers.length - 1,
                image: item.image,
            }
        });
    }

    convert(IR: SceneIR, wireUp: (T: WireUpInput) => void) {
        const geometries = this.convertGeos(IR.geometries, IR.attributes);
        const samplers = this.convertSamplers(IR.samplers);
        const images = this.convertImages(IR.images);
        const materials = this.convertMaterials(IR.materials);
        const primitives = this.convertPrimitives(IR.primitives);
        const meshes = this.convertMeshes(IR.meshes);
        const nodes = this.convertNodes(IR.roots);
        const textures = this.convertTexture(IR.textures, samplers);
        wireUp({
            geometries,
            images,
            samplers,
            primitives,
            materials,
            meshes,
            nodes,
            textures
        })

        return {
            geometries,
            samplers,
            images,
            materials,
            primitives,
            meshes,
            nodes,
            textures
        }
    }
}