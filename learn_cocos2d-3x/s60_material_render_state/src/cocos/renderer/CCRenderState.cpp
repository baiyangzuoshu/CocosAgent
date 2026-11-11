#include "CCRenderState.h"

#include <iostream>
#include <vector>

void GLState::apply(const RenderState::StateBlock& state) {
    if (state.hasBlend) {
        std::cout << (state.blendEnabled ? "glEnable(GL_BLEND)" : "glDisable(GL_BLEND)") << "\n";
    }
    if (state.hasBlendFunc) {
        std::cout << "glBlendFunc(" << state.blendSrc << ", " << state.blendDst << ")\n";
    }
    if (state.hasDepthTest) {
        std::cout << (state.depthTest ? "glEnable(GL_DEPTH_TEST)" : "glDisable(GL_DEPTH_TEST)") << "\n";
    }
}

void RenderState::bind(GLState& gl) const {
    std::vector<const RenderState*> hierarchy;
    for (const RenderState* state = this; state; state = state->m_parent) {
        hierarchy.push_back(state);
    }
    std::cout << "RenderState hierarchy: Material -> Technique -> Pass\n";
    for (auto it = hierarchy.rbegin(); it != hierarchy.rend(); ++it) {
        gl.apply((*it)->m_state);
    }
}
