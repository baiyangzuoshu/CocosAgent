#include "CCPass.h"

#include "CCMaterial.h"
#include "CCTechnique.h"

#include <iostream>

void Pass::preparePipeline(
    const Material& material,
    const Technique& technique,
    PipelineDescriptor& descriptor) const {
    RenderState::bindPass(material.state(), technique.state(), m_renderState.state(), descriptor);
    std::cout << "Pass " << m_name << " prepared blend="
              << descriptor.blendEnabled << " func=(" << descriptor.blendSrc
              << ", " << descriptor.blendDst << ") depth=" << descriptor.depthTest << "\n";
}
