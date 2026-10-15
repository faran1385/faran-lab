import {v4 as uuidv4} from "uuid";
import type {NodeWrapper} from "./NodeWrapper.ts";
import type {SkinningMethod} from "../skinning/SkinningMethod.ts";
import {bumpEpoch} from "../hashing/utils/epoch.ts";

/**
 * A skin as it exists in a live scene: the joint nodes (resolved from the file's node indices) and their inverse bind
 * matrices, plus the SkinningMethod that decides how a palette is computed from them and in which layout.
 *
 * One instance per skin of an imported file. Every mesh node that uses that skin points at the same instance, so they
 * share one palette. The palette's GPU buffer is keyed by getPaletteKey().
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

    /**
     * The method that computes this skin's palette (LBS, DQS, ...). It decides the palette layout and the shader code,
     * so changing it rebuilds the palette buffer, the node bind group and the vertex shader of every node using this
     * skin. The method instance must not be shared with another skin.
     */
    setSkinning(method: SkinningMethod | undefined): void {
        if (this.skinning === method) return;
        method?.attach(this);
        this.skinning?.detach(this);
        this.skinning = method;
        bumpEpoch();   // wakes the render cache: nodes compare the method they were built with
    }

    getSkinning(): SkinningMethod | undefined {
        return this.skinning;
    }

    /** Key of this skin's palette buffer. Includes the method id: another method means another buffer size/layout. */
    getPaletteKey(): string | undefined {
        return this.skinning ? `${this.uuid}|${this.skinning.id}` : undefined;
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

    /**
     * Sum of the joints' world versions. Each joint's version only ever increases, so the sum changes exactly when
     * some joint's world matrix was rebuilt: compare it for equality with the value from the last palette write to
     * skip rewriting an idle skin. It is a plain integer sum, deliberately not an epoch stamp, so a moving skeleton
     * never invalidates cached render items.
     */
    getJointsWorldVersion(): number {
        let sum = 0;
        for (const joint of this.jointNodes) sum += joint.getWorldVersion();
        return sum;
    }
}
