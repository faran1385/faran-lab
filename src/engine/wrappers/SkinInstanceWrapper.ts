import {v4 as uuidv4} from "uuid";
import type {NodeWrapper} from "./NodeWrapper.ts";

/**
 * A skin as it exists in a live scene: the joint nodes (resolved from the file's node indices) and their inverse bind
 * matrices. Data only. How a palette is computed from it, and in which layout, is up to a skinning module.
 *
 * One instance per skin of an imported file. Every mesh node that uses that skin points at the same instance, so they
 * share one palette. The palette's GPU buffer is keyed by this wrapper's uuid.
 */
export class SkinInstanceWrapper {
    readonly uuid: string;
    readonly name?: string;

    private readonly jointNodes: readonly NodeWrapper[];
    /** One column-major mat4 (16 floats) per joint, in jointNodes order. */
    private readonly inverseBindMatrices: Float32Array;

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
