#pragma once

#include "CCGLProgram.h"

#include <string>
#include <unordered_map>

class UniformValue {
public:
    UniformValue(GLProgram& program, const Uniform& uniform)
        : m_program(&program), m_uniform(uniform) {}
    void setFloat(float value) { m_floatValue = value; }
    void apply();

private:
    GLProgram* m_program;
    Uniform m_uniform;
    float m_floatValue = 0.0f;
};

class GLProgramState {
public:
    explicit GLProgramState(GLProgram& program);
    void setUniformFloat(const std::string& name, float value);
    void applyGLProgram();
    void applyUniforms();

private:
    GLProgram& m_program;
    std::unordered_map<std::string, int> m_uniformsByName;
    std::unordered_map<int, UniformValue> m_uniforms;
};
