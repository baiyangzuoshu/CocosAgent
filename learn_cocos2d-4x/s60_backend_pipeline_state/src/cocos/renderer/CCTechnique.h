#pragma once

#include "CCRenderState.h"

#include <string>
#include <utility>
#include <vector>

class Pass;

class Technique {
public:
    explicit Technique(std::string name) : m_name(std::move(name)) {}
    RenderState::StateBlock& state() { return m_renderState.state(); }
    const RenderState::StateBlock& state() const { return m_renderState.state(); }
    void addPass(Pass* pass) { m_passes.push_back(pass); }
    const std::vector<Pass*>& passes() const { return m_passes; }
    const std::string& name() const { return m_name; }

private:
    std::string m_name;
    RenderState m_renderState;
    std::vector<Pass*> m_passes;
};
