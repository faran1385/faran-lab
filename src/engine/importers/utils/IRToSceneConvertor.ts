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
    Skin,
    AnimationClip,
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
import {SkinInstanceWrapper} from "../../skinning/SkinInstanceWrapper.ts";
import {AnimationClipWrapper, type AnimationChannelWrapper} from "../../skinning/AnimationClipWrapper.ts";
import {VertexSkinnedAssembler} from "../../Assemblers/SkinnedAssembler/VertexSkinnedAssembler.ts";


export type ConvertedIRResult = {
    root: NodeWrapper
    /** One per skin in the file. Skinned nodes already reference theirs through their animation handler. */
    skinInstances: SkinInstanceWrapper[]
    /** The file's animations ("walk", "run", ...). Not owned by a skin, see AnimationClipWrapper. */
    clips: AnimationClipWrapper[]
}

/**
 * State collected while the node tree is built, for the steps that need the finished tree: skins resolve joint node
 * indices, clips resolve channel targets, and skinned nodes get their skin attached.
 */
interface NodeBuildContext {
    byIndex: Map<number, NodeWrapper>;
    skinned: { wrapper: NodeWrapper; skin: number }[];
    /** Meshes drawn by at least one node without a skin (see attachSkins). */
    unskinnedMeshes: Set<MeshWrapper>;
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

        const context: NodeBuildContext = {byIndex: new Map(), skinned: [], unskinnedMeshes: new Set()};
        const root = this.createSceneRoot(ir.roots, meshes, context);

        // Both need the finished tree, so they run after it.
        const skinInstances = ir.skins.map((skin) => this.createSkinInstance(skin, context));
        this.attachSkins(context, skinInstances);
        const clips = ir.animations.map((clip) => this.createClipWrapper(clip, context));

        return {root, skinInstances, clips};
    }

    // -- attributes / geometry -------------------------------------------

    private static createAttributeWrapper(name: AttributeName, attribute: Attribute): AttributeWrapper {
        return new AttributeWrapper(name, attribute.data, attribute.format);
    }

    private static createGeometryWrapper(geometry: Geometry, attributePool: Attribute[]): GeometryWrapper {
        const wrapper = new GeometryWrapper();

        for (const key in geometry.attributes) {
            const name = key as AttributeName;
            wrapper.setAttribute(
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

    private static createNodeWrapper(node: Node, meshes: MeshWrapper[], context: NodeBuildContext): NodeWrapper {
        const wrapper = new NodeWrapper(node.translation, node.rotation, node.scale, node.name);
        context.byIndex.set(node.index, wrapper);

        if (node.mesh !== undefined) {
            wrapper.setMesh(meshes[node.mesh]);
            if (node.skin === undefined) context.unskinnedMeshes.add(meshes[node.mesh]);
        }

        if (node.skin !== undefined) {
            context.skinned.push({wrapper, skin: node.skin});
        }

        for (const child of node.children) {
            wrapper.addChild(this.createNodeWrapper(child, meshes, context));
        }

        return wrapper;
    }

    private static createSceneRoot(roots: Node[], meshes: MeshWrapper[], context: NodeBuildContext): NodeWrapper {
        const root = new NodeWrapper(undefined, undefined, undefined, "RendererSceneRoot");

        for (const node of roots) {
            root.addChild(this.createNodeWrapper(node, meshes, context));
        }

        return root;
    }

    // -- skins -----------------------------------------------------------

    private static createSkinInstance(skin: Skin, context: NodeBuildContext): SkinInstanceWrapper {
        const jointNodes = skin.joints.map((nodeIndex) => {
            const node = context.byIndex.get(nodeIndex);
            if (!node) {
                // importNode only walks the scene's node tree, so a joint outside it was never imported.
                throw new Error(`IRToSceneConvertor: skin joint node ${nodeIndex} is not part of the imported scene`);
            }
            return node;
        });

        return new SkinInstanceWrapper(jointNodes, skin.inverseBindMatrices, skin.name);
    }

    /**
     * Gives every skinned node its skin instance and switches its primitives to the skinned vertex assembler.
     *
     * Assemblers live on the primitive, and a mesh may be drawn by several nodes. A mesh shared between a skinned
     * and an unskinned node can't have both, so that case warns: the unskinned node would run the skinned assembler
     * against a bind group without a palette.
     */
    private static attachSkins(context: NodeBuildContext, skinInstances: SkinInstanceWrapper[]): void {
        for (const {wrapper, skin} of context.skinned) {
            const instance = skinInstances[skin];
            if (!instance) {
                throw new Error(`IRToSceneConvertor: node references skin ${skin}, which does not exist`);
            }

            wrapper.getAnimationHandler().setSkinInstance(instance);

            const mesh = wrapper.getMesh();
            if (!mesh) continue;

            if (context.unskinnedMeshes.has(mesh)) {
                console.warn(
                    `IRToSceneConvertor: mesh of skinned node "${wrapper.getName() ?? wrapper.uuid}" is also used by a node without a skin; its primitives can only have one vertex assembler`,
                );
            }

            for (const primitive of mesh.getAllPrimitives()) {
                if (primitive.getVertexAssembler() instanceof VertexSkinnedAssembler) continue;
                primitive.setVertexAssembler(new VertexSkinnedAssembler());
            }
        }
    }

    // -- animation clips -------------------------------------------------

    private static createClipWrapper(clip: AnimationClip, context: NodeBuildContext): AnimationClipWrapper {
        const channels: AnimationChannelWrapper[] = [];

        for (const channel of clip.channels) {
            const target = context.byIndex.get(channel.node);
            if (!target) {
                // Clips may animate nodes outside the scene (cameras, unused props). Nothing to drive here.
                console.warn(
                    `IRToSceneConvertor: clip "${clip.name ?? "(unnamed)"}" targets node ${channel.node}, which is not part of the imported scene; channel skipped`,
                );
                continue;
            }

            const sampler = clip.samplers[channel.sampler];
            if (!sampler) {
                throw new Error(`IRToSceneConvertor: clip "${clip.name ?? "(unnamed)"}" references missing sampler ${channel.sampler}`);
            }

            channels.push({target, path: channel.path, sampler});
        }

        return new AnimationClipWrapper(channels, clip.duration, clip.name);
    }
}
