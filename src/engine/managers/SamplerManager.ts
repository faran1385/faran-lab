import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";
import type {Hasher} from "../hashing/Hasher.ts";
import {SamplerResourceWrapper} from "./SamplerResourceWrapper.ts";

export class SamplerManager {
    private samplers = new Map<string, SamplerResourceWrapper>();

    ensure(
        sampler: SamplerWrapper,
        hasher: Hasher,
        device: GPUDevice
    ): SamplerResourceWrapper {
        const hash = sampler.convertToHash(hasher);

        const existing = this.samplers.get(hash);
        if (existing) {
            existing.retain();
            return existing;
        }

        const gpuSampler = device.createSampler({
            minFilter: sampler.getMinFilter(),
            magFilter: sampler.getMagFilter(),
            mipmapFilter: sampler.getMipFilter(),
            addressModeU: sampler.getAddressModeU(),
            addressModeV: sampler.getAddressModeV(),
        });

        const wrapper = new SamplerResourceWrapper(hash, gpuSampler);
        wrapper.retain();
        this.samplers.set(hash, wrapper);
        return wrapper;
    }

    get(hash: string): SamplerResourceWrapper | undefined {
        return this.samplers.get(hash);
    }
}