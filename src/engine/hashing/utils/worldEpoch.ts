/**
 * World-matrix change counter. Bumped whenever any node's world matrix is rebuilt (NodeWrapper.buildWorldMatrix).
 *
 * Deliberately separate from the render epoch (epoch.ts): transforms must not invalidate render items, but skin
 * palettes need a cheap "did anything move since I last looked" gate so quiet frames cost one integer compare
 * instead of a walk over every joint.
 *
 * Like epoch.ts it only increases, is never reset, and must stay free of imports.
 */
let worldEpoch = 0;

export function bumpWorldEpoch(): number {
    return ++worldEpoch;
}

export function getWorldEpoch(): number {
    return worldEpoch;
}
