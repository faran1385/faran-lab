import type {
    Attribute,
    Geometry,
    Image,
    Material,
    Mesh,
    Node,
    Primitive,
    Sampler,
    SceneIR, Texture
} from "../importers/utils/IR.ts";
import {AttributeWrapper} from "./AttributeWrapper.ts";
import {GeometryWrapper} from "./GeometryWrapper.ts";
import {SamplerWrapper} from "./SamplerWrapper.ts";
import {ImageWrapper} from "./ImageWrapper.ts";
import {MaterialWrapper} from "./MaterialWrapper.ts";
import {PrimitiveWrapper} from "./PrimitiveWrapper.ts";
import {MeshWrapper} from "./MeshWrapper.ts";
import {NodeWrapper} from "./NodeWrapper.ts";
import {TextureWrapper} from "./TextureWrapper.ts";


type NodeHierarchy = {
    wrapper: NodeWrapper,
    mesh?: number,
    children: NodeHierarchy[],
}

export class IRToWrapperConvertor {

    constructor() {
    }

    createAttributeWrapper(name: string, attr: Attribute) {
        return new AttributeWrapper(name, attr.data, attr.format);
    }

    createGeometryWrapper(geometry: Geometry) {
        return new GeometryWrapper(geometry.indices, geometry.boundingBox);
    }

    private convertGeos(geoList: Geometry[]) {

        return geoList.map((item) => {
            const attributeWrapperList: AttributeWrapper[] = [];
            for (let key in item.attributes) {
                attributeWrapperList.push(this.createAttributeWrapper(key, item.attributes[key]));
            }

            return {
                geometry: this.createGeometryWrapper(item),
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

    createImageWrapper(memeType: string, data: ArrayBuffer) {
        return new ImageWrapper(memeType, data)
    }

    createMaterialWrapper(
        components: Material["components"],
        alphaMode: Material["alphaMode"],
        alphaCutoff: Material["alphaCutoff"],
        doubleSided: Material["doubleSided"]
    ) {
        return new MaterialWrapper(components, alphaMode, alphaCutoff, doubleSided)
    }

    createPrimitiveWrapper(topology: Primitive["topology"]) {
        return new PrimitiveWrapper(topology);
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

    private convertImages(images: Image[]) {
        return images.map((item) => {
            return this.createImageWrapper(item.mimeType, item.data)
        })
    }

    private convertMaterials(materials: Material[]) {
        return materials.map((item) => {
            return this.createMaterialWrapper(item.components, item.alphaMode, item.alphaCutoff, item.doubleSided)
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

    private convertTexture(textures: Texture[]) {
        return textures.map(item => {
            return {
                wrapper: this.createTextureWrapper(),
                sampler: item.sampler,
                image: item.image,
            }
        });
    }

    convert(IR: SceneIR) {
        const geometries = this.convertGeos(IR.geometries);
        const samplers = this.convertSamplers(IR.samplers);
        const images = this.convertImages(IR.images);
        const materials = this.convertMaterials(IR.materials);
        const primitives = this.convertPrimitives(IR.primitives);
        const meshes = this.convertMeshes(IR.meshes);
        const nodes = this.convertNodes(IR.roots);
        const textures=this.convertTexture(IR.textures);


    }
}