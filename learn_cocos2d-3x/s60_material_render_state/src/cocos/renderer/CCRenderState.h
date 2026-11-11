#pragma once

#include <string>

class GLState;

class RenderState {
public:
    struct StateBlock {
        bool hasBlend = false;
        bool blendEnabled = false;
        bool hasBlendFunc = false;
        std::string blendSrc;
        std::string blendDst;
        bool hasDepthTest = false;
        bool depthTest = false;
    };

    explicit RenderState(RenderState* parent = nullptr) : m_parent(parent) {}
    StateBlock& state() { return m_state; }
    void bind(GLState& gl) const;

private:
    RenderState* m_parent;
    StateBlock m_state;
};

class GLState {
public:
    void apply(const RenderState::StateBlock& state);
};
