import {v4 as uuidv4} from "uuid";
import type {NodeWrapper} from "./NodeWrapper.ts";
import type {SkinningMethod} from "../skinning/SkinningMethod.ts";
import {bumpEpoch} from "../hashing/utils/epoch.ts";

/**
 * A skin as it exists in a live scene: joint nodes, inverse bind matrices, and its selected skinning method.
 * Each skin owns its method instance so method-local scratch data and update versions cannot leak between skins.
 */
export class SkinInstanceWrapper {
    readonly uuid: string;
    readonly name?: string;

    private readonly jointNodes: readonly NodeWrapper[];
    /** One column-major mat4 (16 floats) per joint, in jointNodes order. */
    private readonly inverseBindMatrices: Float32Array;
    private skinning?: SkinningMethod;

    constructor(jointNodes: readonly NodeWrapper[], inverseBindMatrices: Float32Array, name?: string) {
        if (jointNodes.length === 0) {
            throw new Error("SkinInstanceWrapper: a skin needs at least one joint");
        }
        if (inverseBindMatrices.length !== jointNodes.length * 16) {
            throw new Error(
                `SkinInstanceWrapper: ${jointNodes.length} joints need ${jointNodes.length * 16} inverse bind matrix floats, got ${inverseBindMatrices.length}`,
            );
        }

        this.uuid = uuidv4();
        this.name = name;
        this.jointNodes = jointNodes;
        this.inverseBindMatrices = inverseBindMatrices;
    }

    getJointNodes(): readonly NodeWrapper[] {
        return this.jointNodes;
    }

    getJointCount(): number {
        return this.jointNodes.length;
    }

    getInverseBindMatrices(): Float32Array {
        return this.inverseBindMatrices;
    }

    getSkinning(): SkinningMethod | undefined {
        return this.skinning;
    }

    /**
     * Stable identity for the palette allocation. A method change deliberately creates a different resource key:
     * the render-entry swap acquires the new allocation before releasing the old one.
     */
    getPaletteKey(): string {
        if (!this.skinning) {
            throw new Error(`SkinInstanceWrapper "${this.name ?? this.uuid}" has no skinning method`);
        }
        return `${this.uuid}|${this.skinning.id}`;
    }

    setSkinning(method: SkinningMethod): void {
        if (this.skinning === method) return;
        method.attach(this);
        this.skinning = method;
        bumpEpoch();
    }

    /**
     * Sum of the joints' world versions. Each joint's version only ever increases, so the sum changes exactly when
     * some joint's world matrix was rebuilt: compare it with the value from the last palette write to skip idle skins.
     */
    getJointsWorldVersion(): number {
        let sum = 0;
        for (const joint of this.jointNodes) sum += joint.getWorldVersion();
        return sum;
    }
}
