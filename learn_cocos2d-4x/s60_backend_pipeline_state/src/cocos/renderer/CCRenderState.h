#pragma once

#include <string>

struct PipelineDescriptor {
    bool blendEnabled = false;
    std::string blendSrc = "ONE";
    std::string blendDst = "ZERO";
    bool depthTest = false;
};

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

        void apply(PipelineDescriptor& descriptor) const;
    };

    StateBlock& state() { return m_state; }
    const StateBlock& state() const { return m_state; }
    static void bindPass(
        const StateBlock& material,
        const StateBlock& technique,
        const StateBlock& pass,
        PipelineDescriptor& descriptor);

private:
    StateBlock m_state;
};
