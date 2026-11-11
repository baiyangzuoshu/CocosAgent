#include "ProgramState.h"

#include <cstring>
#include <iostream>
#include <stdexcept>

namespace backend {

ProgramState::ProgramState(Program& program)
    : m_program(program),
      m_vertexUniforms(program.vertexUniformBufferSize()),
      m_fragmentUniforms(program.fragmentUniformBufferSize()) {}

void ProgramState::setUniform(const UniformLocation& location, const void* data, std::size_t size) {
    std::vector<unsigned char>& buffer = location.stage == ShaderStage::Vertex
        ? m_vertexUniforms : m_fragmentUniforms;
    if (location.offset + size > buffer.size()) throw std::out_of_range("uniform write exceeds stage buffer");
    std::memcpy(buffer.data() + location.offset, data, size);
    std::cout << "ProgramState copied " << size << " bytes for " << location.name
              << " into " << (location.stage == ShaderStage::Vertex ? "vertex" : "fragment")
              << " uniform buffer\n";
}

float ProgramState::readFirstFloat(const UniformLocation& location) const {
    const std::vector<unsigned char>& buffer = location.stage == ShaderStage::Vertex
        ? m_vertexUniforms : m_fragmentUniforms;
    float value = 0.0f;
    std::memcpy(&value, buffer.data() + location.offset, sizeof(value));
    return value;
}

} // namespace backend
