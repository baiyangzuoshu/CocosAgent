#include "CCGLProgram.h"

#include <iostream>

void GLProgram::link(const std::string& name, int location) {
    m_uniforms[name] = {name, location};
    std::cout << "linked shader; reflected " << name << " at " << location << "\n";
}

const Uniform* GLProgram::getUniform(const std::string& name) const {
    const auto found = m_uniforms.find(name);
    return found == m_uniforms.end() ? nullptr : &found->second;
}

int GLProgram::getUniformLocation(const std::string& name) const {
    const auto found = m_uniforms.find(name);
    return found == m_uniforms.end() ? -1 : found->second.location;
}

void GLProgram::use() {
    std::cout << "GLProgram::use\n";
}

void GLProgram::setUniform1f(int location, float value) {
    if (location >= 0) std::cout << "glUniform1f(" << location << ", " << value << ")\n";
}
