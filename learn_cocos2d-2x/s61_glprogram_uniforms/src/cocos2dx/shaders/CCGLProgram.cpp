#include "CCGLProgram.h"

#include <iostream>

void CCGLProgram::initWithVertexShaderByteArray(const std::string& vertex, const std::string& fragment) {
    std::cout << "compile vertex/fragment shader bytes: " << vertex.size() << ", " << fragment.size() << "\n";
}

void CCGLProgram::addAttribute(const std::string& name, unsigned int index) {
    std::cout << "glBindAttribLocation(" << index << ", " << name << ")\n";
}

void CCGLProgram::link() {
    std::cout << "glLinkProgram\n";
}

void CCGLProgram::updateUniforms() {
    m_uniformLocations["u_MVPMatrix"] = 0;
    std::cout << "cache built-in uniform u_MVPMatrix = 0\n";
}

void CCGLProgram::use() {
    std::cout << "glUseProgram\n";
}

int CCGLProgram::getUniformLocationForName(const std::string& name) const {
    std::cout << "glGetUniformLocation(" << name << ")\n";
    if (name == "u_tint") return 3;
    const auto found = m_uniformLocations.find(name);
    return found == m_uniformLocations.end() ? -1 : found->second;
}

void CCGLProgram::setUniformLocationWith4f(int location, float x, float y, float z, float w) {
    if (location >= 0) std::cout << "glUniform4f(" << location << ", " << x << ", " << y << ", " << z << ", " << w << ")\n";
}
