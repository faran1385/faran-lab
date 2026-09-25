import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";

export class SamplerProducer {
    static produce(sampler: SamplerWrapper): GPUSamplerDescriptor {
        return {
            minFilter: sampler.getMinFilter(),
            magFilter: sampler.getMagFilter(),
            mipmapFilter: sampler.getMipFilter(),
            addressModeU: sampler.getAddressModeU(),
            addressModeV: sampler.getAddressModeV(),
        };
    }
}