#pragma once

#include "CCRenderState.h"

class Technique;

class GLProgramState {
public:
    void apply() const;
};

class Pass : public RenderState {
public:
    explicit Pass(Technique* parent);
    void bind(GLState& gl, const GLProgramState& program) const;
};
