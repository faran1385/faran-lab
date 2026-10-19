import {RepresentationHashProvider} from "./RepresentationHashProvider.ts";
import type {BindgroupEntry} from "../Representations/BindgroupRepresentation.ts";
import type {BindgroupLayoutRepresentation} from "../Representations/BindgroupLayoutRepresentation.ts";
import type {Hasher} from "./utils/Hasher.ts";
import {BufferWrapper} from "../wrappers/BufferWrapper.ts";
import {ImageWrapper} from "../wrappers/ImageWrapper.ts";

type InputFunctions = {
    getEntries: () => Map<number, BindgroupEntry>,
    getLayout: () => BindgroupLayoutRepresentation,
}

function resourceHash(resource: BindgroupEntry["resource"], hasher: Hasher): string {
    if (resource instanceof BufferWrapper) return `b:${resource.hashProvider.convertToHash()}`;
    if (resource instanceof ImageWrapper) return `i:${resource.hashProvider.convertToHash(hasher)}`;
    return `s:${resource.hashProvider.convertToHash(hasher)}`;
}

function resourceChangedAt(resource: BindgroupEntry["resource"]): number {
    return resource.hashProvider.getChangedAt();
}

/**
 * Layout hash plus the identity of every bound resource. Buffer *contents* are not part of it (they are uploaded, not
 * rebound), but a buffer's size is, because a different size is a different GPU buffer.
 */
export class BindgroupRepresentationHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: (hasher) => {
                const layout = T.getLayout();
                const layoutHash = layout.hashProvider.convertToHash(hasher);
                const entries = Array.from(T.getEntries().entries())
                    .sort(([a], [b]) => a - b)
                    .map(([binding, entry]) => `${binding}=${resourceHash(entry.resource, hasher)}`)
                    .join("|");
                return `${layoutHash}#${entries}`;
            },
            getChildrenChangedAt: () => {
                let at = T.getLayout().hashProvider.getChangedAt();
                for (const entry of T.getEntries().values()) at = Math.max(at, resourceChangedAt(entry.resource));
                return at;
            },
        });
    }
}
