#include "CCPass.h"
#include "CCTechnique.h"

#include <iostream>

Pass::Pass(Technique* parent) : RenderState(parent) {}

void GLProgramState::apply() const {
    std::cout << "GLProgramState applies program and uniforms\n";
}

void Pass::bind(GLState& gl, const GLProgramState& program) const {
    program.apply();
    RenderState::bind(gl);
}
