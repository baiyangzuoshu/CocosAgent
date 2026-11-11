#include "CCPass.h"

void Pass::bind() {
    m_programState.applyGLProgram();
    m_programState.applyUniforms();
}
