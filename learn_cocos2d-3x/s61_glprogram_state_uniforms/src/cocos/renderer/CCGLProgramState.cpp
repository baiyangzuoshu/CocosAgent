#include "CCGLProgramState.h"

#include <iostream>

void UniformValue::apply() {
    m_program->setUniform1f(m_uniform.location, m_floatValue);
}

GLProgramState::GLProgramState(GLProgram& program) : m_program(program) {
    for (const auto& entry : m_program.getUniforms()) {
        m_uniformsByName[entry.first] = entry.second.location;
        m_uniforms.emplace(entry.second.location, UniformValue(m_program, entry.second));
    }
}

void GLProgramState::setUniformFloat(const std::string& name, float value) {
    const auto location = m_uniformsByName.find(name);
    if (location == m_uniformsByName.end()) {
        std::cout << "Uniform not found: " << name << "\n";
        return;
    }
    m_uniforms.at(location->second).setFloat(value);
    std::cout << "GLProgramState stored " << name << " = " << value << "\n";
}

void GLProgramState::applyGLProgram() {
    m_program.use();
}

void GLProgramState::applyUniforms() {
    for (auto& entry : m_uniforms) entry.second.apply();
}
