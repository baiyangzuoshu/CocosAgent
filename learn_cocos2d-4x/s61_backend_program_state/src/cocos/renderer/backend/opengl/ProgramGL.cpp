#include "ProgramGL.h"

#include <iostream>

namespace backend {

void ProgramGL::compileAndReflect(const std::string& vertexSource, const std::string& fragmentSource) {
    std::cout << "ProgramGL compiles stages: " << vertexSource.size() << ", " << fragmentSource.size() << " bytes\n";
    std::cout << "glLinkProgram; reflect attributes and uniforms\n";
    addUniform("u_tint", ShaderStage::Fragment, 0, sizeof(float) * 4);
}

} // namespace backend
