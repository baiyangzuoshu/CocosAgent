#include "CCRenderState.h"

#include <iostream>

void RenderState::StateBlock::apply(PipelineDescriptor& descriptor) const {
    if (hasBlend) descriptor.blendEnabled = blendEnabled;
    if (hasBlendFunc) {
        descriptor.blendSrc = blendSrc;
        descriptor.blendDst = blendDst;
    }
    if (hasDepthTest) descriptor.depthTest = depthTest;
}

void RenderState::bindPass(
    const StateBlock& material,
    const StateBlock& technique,
    const StateBlock& pass,
    PipelineDescriptor& descriptor) {
    descriptor = PipelineDescriptor{};
    material.apply(descriptor);
    technique.apply(descriptor);
    pass.apply(descriptor);
    std::cout << "RenderState -> backend PipelineDescriptor\n";
}
