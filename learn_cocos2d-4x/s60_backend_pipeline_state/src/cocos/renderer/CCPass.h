#pragma once

#include "CCRenderState.h"

#include <string>
#include <utility>

class Material;
class Technique;

class Pass {
public:
    explicit Pass(std::string name) : m_name(std::move(name)) {}
    RenderState::StateBlock& state() { return m_renderState.state(); }
    void preparePipeline(const Material& material, const Technique& technique, PipelineDescriptor& descriptor) const;
    const std::string& name() const { return m_name; }

private:
    std::string m_name;
    RenderState m_renderState;
};
