#pragma once

#include "CCRenderState.h"

#include <vector>

class Technique;

class Material : public RenderState {
public:
    Material() = default;
    void addTechnique(Technique* technique) { m_techniques.push_back(technique); }

private:
    std::vector<Technique*> m_techniques;
};
