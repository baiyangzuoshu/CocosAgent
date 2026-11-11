#include "CCMaterial.h"

#include "CCPass.h"
#include "CCTechnique.h"

#include <iostream>

void Material::preparePasses() const {
    if (!m_technique) {
        std::cout << "Material has no Technique\n";
        return;
    }

    for (const Pass* pass : m_technique->passes()) {
        PipelineDescriptor descriptor;
        pass->preparePipeline(*this, *m_technique, descriptor);
    }
}
