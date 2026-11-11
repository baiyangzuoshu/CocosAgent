#pragma once

#include "CCRenderState.h"

#include <string>
#include <vector>

class Material;
class Pass;

class Technique : public RenderState {
public:
    Technique(Material* parent, std::string name);
    void addPass(Pass* pass) { m_passes.push_back(pass); }
    const std::string& name() const { return m_name; }

private:
    std::string m_name;
    std::vector<Pass*> m_passes;
};
