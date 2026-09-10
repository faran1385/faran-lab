import type {SamplerWrapper} from "../wrappers/SamplerWrapper.ts";
import {SamplerTracker} from "../Trackers/Trackers.ts";
import {SamplerDescriptorProducer} from "../descriptorProducer/SamplerDescriptorProducer.ts";
import {ResourceManager} from "./Manager.ts";

export class SamplerManager extends ResourceManager<SamplerWrapper, GPUSampler, SamplerTracker> {
    createOrGetFromSampler(sampler: SamplerWrapper): SamplerTracker {
        return this.createOrGet(sampler);
    }

    protected getHash(sampler: SamplerWrapper): string {
        return sampler.convertToHash(this.hasher);
    }

    protected createResource(sampler: SamplerWrapper): GPUSampler {
        const descriptor = SamplerDescriptorProducer.produce(sampler);
        return this.device.createSampler(descriptor);
    }

    protected createTracker(resource: GPUSampler): SamplerTracker {
        return new SamplerTracker(resource);
    }
}