/**
 * Global change counter ("epoch").
 *
 * Every wrapper setter that can affect a hash, a bind group, a buffer or a pipeline stamps the wrapper with a
 * fresh epoch (see ChangeStamp). Consumers (the renderer) remember the epoch they last built at and compare.
 *
 * - Only setters ever write here; nothing reads wrappers' children through this file, so the data flow stays
 *   top-down (primitive -> material -> component -> texture -> image).
 * - The counter only increases and is never reset, so any number of renderers can share it.
 * - This file must stay free of imports so it can never be part of an import cycle.
 */
let epoch = 0;

/** Advance the epoch and return the new value. Call only when something really changed. */
export function bumpEpoch(): number {
    return ++epoch;
}

export function getEpoch(): number {
    return epoch;
}
