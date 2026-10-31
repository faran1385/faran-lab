import {v4 as uuidv4} from "uuid";
import {SkinAdaptor} from "../Adaptors/SkinAdaptor.ts";
import {LBSSkinning} from "../../packages/animations/LBSSkinning.ts";
import type {NodeWrapper} from "./NodeWrapper.ts";
import type {SkinningMethod} from "../skinning/SkinningMethod.ts";

/**
 * A skin as it exists in a live scene: the joint nodes with their inverse bind matrices, plus the SkinningMethod that
 * decides how the palette is computed and which shader code reads it.
 *
 * One skin per skin of an imported file. Every node whose mesh uses it points at the same SkinWrapper (through its
 * animation handler), so they share one palette.
 */
export class SkinWrapper {
    readonly uuid: string;
    readonly name?: string;
    readonly adaptor: SkinAdaptor;

    /**
     * joint node -> inverse bind matrix (16 floats, column-major, as glTF ships them; identity when the file has none).
     * The Map's insertion order is the palette index, so it must be the order of the file's `joints[]`: the vertex
     * `joints0` attribute indexes into it.
     */
    private readonly joints: Map<NodeWrapper, Float32Array>;
    private method: SkinningMethod;

    constructor(joints: Map<NodeWrapper, Float32Array>, method?: SkinningMethod, name?: string) {
        if (joints.size === 0) throw new Error("SkinWrapper: a skin needs at least one joint");
        for (const [node, inverseBind] of joints) {
            if (inverseBind.length !== 16) {
                throw new Error(`SkinWrapper: the inverse bind matrix of joint "${node.getName() ?? node.uuid}" has ${inverseBind.length} floats, expected 16`);
            }
        }

        this.uuid = uuidv4();
        this.name = name;
        this.joints = joints;
        this.method = method ?? new LBSSkinning();
        this.adaptor = new SkinAdaptor(this);
    }

    getJoints(): ReadonlyMap<NodeWrapper, Float32Array> {
        return this.joints;
    }

    getJointCount(): number {
        return this.joints.size;
    }

    getMethod(): SkinningMethod {
        return this.method;
    }

    /**
     * Changes how this skin deforms (LBS, DQS, ...). The palette layout and the shader code change with it, so the
     * palette buffer is replaced and the vertex shader of every node using this skin is regenerated.
     */
    setMethod(method: SkinningMethod): void {
        if (this.method === method) return;
        this.method = method;
        this.adaptor.onMethodChanged();
    }

    dispose(): void {
        this.adaptor.dispose();
    }
}
