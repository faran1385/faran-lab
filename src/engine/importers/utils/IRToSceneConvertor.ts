import type {
    SceneIR,
    Geometry,
    Material,
    MaterialComponentIR,
    Attribute,
    DecodedImage,
    Sampler,
    Texture,
    Primitive,
    Mesh,
    Node,
    AttributeName,
} from "./IR.ts";

import {AttributeWrapper} from "../../wrappers/AttributeWrapper.ts";
import {IndexAttributeWrapper} from "../../wrappers/IndexWrapper.ts";
import {GeometryWrapper} from "../../wrappers/GeometryWrapper.ts";
import {ImageWrapper} from "../../wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "../../wrappers/SamplerWrapper.ts";
import {TextureWrapper} from "../../wrappers/TextureWrapper.ts";
import {MaterialComponentWrapper} from "../../wrappers/MaterialComponentWrapper.ts";
import {MaterialWrapper} from "../../wrappers/MaterialWrapper.ts";
import {PrimitiveWrapper} from "../../wrappers/PrimitiveWrapper.ts";
import {MeshWrapper} from "../../wrappers/MeshWrapper.ts";
import {NodeWrapper} from "../../wrappers/NodeWrapper.ts";


export type ConvertedIRResult = {
    root: NodeWrapper
}

/**
 * Converts a SceneIR (flat, index-based — GLTFImporter's output) into a
 * connected wrapper graph. Build order is bottom-up: images -> samplers ->
 * textures -> geometries -> materials -> primitives -> meshes -> nodes.
 * Every ref in SceneIR resolves "backwards" through that order, so by the
 * time each stage runs, everything it needs already exists as a wrapper —
 * no separate unresolved-refs/WireUp pass needed here.
 *
 * Node is the exception: it's already a real tree in the IR (children:
 * Node[], not indices), so it's a recursive walk, attached top-down via
 * NodeWrapper.addChild (which self-manages the parent link).
 *
 * All root nodes get collected under one identity-transform NodeWrapper
 * ("SceneRoot") rather than returned as a bare array.
 */
export class IRToSceneConvertor {
    static convert(ir: SceneIR): ConvertedIRResult {
        const images = ir.images.map((image) => this.createImageWrapper(image));
        const samplers = ir.samplers.map((sampler) => this.createSamplerWrapper(sampler));
        const textures = ir.textures.map((texture) =>
            this.createTextureWrapper(texture, images, samplers),
        );

        const geometries = ir.geometries.map((geometry) =>
            this.createGeometryWrapper(geometry, ir.attributes),
        );
        const materials = ir.materials.map((material) =>
            this.createMaterialWrapper(material, textures),
        );

        const primitives = ir.primitives.map((primitive) =>
            this.createPrimitiveWrapper(primitive, geometries, materials),
        );
        const meshes = ir.meshes.map((mesh) => this.createMeshWrapper(mesh, primitives));

        return {
            root: this.createSceneRoot(ir.roots, meshes)
        }
    }

    // -- attributes / geometry -------------------------------------------

    private static createAttributeWrapper(name: AttributeName, attribute: Attribute): AttributeWrapper {
        return new AttributeWrapper(name, attribute.data, attribute.format);
    }

    private static createGeometryWrapper(geometry: Geometry, attributePool: Attribute[]): GeometryWrapper {
        const wrapper = new GeometryWrapper();

        for (const key in geometry.attributes) {
            const name = key as AttributeName;
            wrapper.addAttribute(
                this.createAttributeWrapper(name, attributePool[geometry.attributes[name]]),
            );
        }

        if (geometry.indices) {
            wrapper.setIndices(
                new IndexAttributeWrapper(geometry.indices.data, geometry.indices.format),
            );
        }

        return wrapper;
    }

    // -- images / samplers / textures ------------------------------------

    private static createImageWrapper(image: DecodedImage): ImageWrapper {
        return new ImageWrapper(image.data, image.width, image.height);
    }

    private static createSamplerWrapper(sampler: Sampler): SamplerWrapper {
        return new SamplerWrapper(
            sampler.minFilter,
            sampler.magFilter,
            sampler.mipFilter,
            sampler.addressModeU,
            sampler.addressModeV,
        );
    }

    private static createTextureWrapper(
        texture: Texture,
        images: ImageWrapper[],
        samplers: SamplerWrapper[],
    ): TextureWrapper {
        const sampler = texture.sampler !== undefined ? samplers[texture.sampler] : new SamplerWrapper();
        return new TextureWrapper(images[texture.image], sampler);
    }

    // -- material ----------------------------------------------------------

    private static createMaterialComponentWrapper(
        name: string,
        component: MaterialComponentIR,
        textures: TextureWrapper[],
    ): MaterialComponentWrapper {
        const wrapper = new MaterialComponentWrapper(name, component.factor);

        if (component.texture) {
            wrapper.setTexture({
                wrapper: textures[component.texture.index],
                texCoord: component.texture.texCoord,
            });
        }

        return wrapper;
    }

    private static createMaterialWrapper(material: Material, textures: TextureWrapper[]): MaterialWrapper {
        const wrapper = new MaterialWrapper({
            alphaMode: material.alphaMode,
            alphaCutoff: material.alphaCutoff,
            doubleSided: material.doubleSided,
        });

        for (const name in material.components) {
            wrapper.setComponent(
                this.createMaterialComponentWrapper(name, material.components[name], textures),
            );
        }

        return wrapper;
    }

    // -- primitive / mesh ----------------------------------------------

    private static createPrimitiveWrapper(
        primitive: Primitive,
        geometries: GeometryWrapper[],
        materials: MaterialWrapper[],
    ): PrimitiveWrapper {
        // PrimitiveWrapper's ctor is (material, geometry) — reversed from
        // the IR's {geometry, material} field order.
        // NOTE: primitive.topology has nowhere to go yet — PrimitiveWrapper
        // exposes no topology field/setter. Dropped on the floor for now.
        return new PrimitiveWrapper(materials[primitive.material], geometries[primitive.geometry]);
    }

    private static createMeshWrapper(mesh: Mesh, primitives: PrimitiveWrapper[]): MeshWrapper {
        const wrapper = new MeshWrapper();

        for (const index of mesh.primitives) {
            wrapper.setPrimitive(primitives[index]);
        }

        return wrapper;
    }

    // -- node graph ------------------------------------------------------

    private static createNodeWrapper(node: Node, meshes: MeshWrapper[]): NodeWrapper {
        const wrapper = new NodeWrapper(node.translation, node.rotation, node.scale, node.name);

        if (node.mesh !== undefined) {
            wrapper.setMesh(meshes[node.mesh]);
        }

        for (const child of node.children) {
            wrapper.addChild(this.createNodeWrapper(child, meshes));
        }

        return wrapper;
    }

    private static createSceneRoot(roots: Node[], meshes: MeshWrapper[]): NodeWrapper {
        const root = new NodeWrapper(undefined, undefined, undefined, "RendererSceneRoot");

        for (const node of roots) {
            root.addChild(this.createNodeWrapper(node, meshes));
        }

        return root;
    }
}