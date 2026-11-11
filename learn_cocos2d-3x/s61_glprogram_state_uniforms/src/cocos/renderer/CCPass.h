#pragma once

#include "CCGLProgramState.h"

class Pass {
public:
    explicit Pass(GLProgramState& programState) : m_programState(programState) {}
    void bind();

private:
    GLProgramState& m_programState;
};
