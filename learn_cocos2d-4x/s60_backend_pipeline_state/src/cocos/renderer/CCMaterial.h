#pragma once

#include "CCRenderState.h"

class Technique;

class Material {
public:
    RenderState::StateBlock& state() { return m_renderState.state(); }
    const RenderState::StateBlock& state() const { return m_renderState.state(); }
    void setTechnique(Technique* technique) { m_technique = technique; }
    void preparePasses() const;

private:
    RenderState m_renderState;
    Technique* m_technique = nullptr;
};
