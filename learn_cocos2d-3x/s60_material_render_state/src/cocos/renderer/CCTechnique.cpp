#include "CCTechnique.h"
#include "CCMaterial.h"

#include <utility>

Technique::Technique(Material* parent, std::string name)
    : RenderState(parent), m_name(std::move(name)) {}
