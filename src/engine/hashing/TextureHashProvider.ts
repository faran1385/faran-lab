import {ChangeStamp} from "./utils/ChangeStamp.ts";
import type {Hasher} from "./utils/Hasher.ts";
import {AggregateHashHandler} from "./utils/AggregateHashHandler.ts";
import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";
import type {ImageWrapper} from "../wrappers/ImageWrapper.ts";

type InputFunctions = {
    getImage: () => ImageWrapper,
    getSampler: () => SamplerWrapper,
}

export class TextureHashProvider {
    private hashHandler: AggregateHashHandler;
    private readonly changeStamp = new ChangeStamp();
    private wrapperFunctions: InputFunctions;

    constructor(T: InputFunctions) {
        this.wrapperFunctions = T;
        this.hashHandler = new AggregateHashHandler((hasher) =>
            `${T.getImage().hashProvider.convertToHash(hasher)}|${T.getSampler().hashProvider.convertToHash(hasher)}`
        );
    }

    markChangeStamp() {
        this.changeStamp.mark();
    }

    convertToHash(hasher: Hasher): string {
        return this.hashHandler.convertToHash(hasher);
    }

    getChangedAt(): number {
        return Math.max(
            this.changeStamp.get(),
            this.wrapperFunctions.getImage().hashProvider.getChangedAt(),
            this.wrapperFunctions.getSampler().hashProvider.getChangedAt()
        )
    }
}