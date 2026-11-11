#include "Program.h"

#include <stdexcept>

namespace backend {

void Program::addUniform(const std::string& name, ShaderStage stage, std::size_t offset, std::size_t size) {
    m_uniforms[name] = {stage, offset, name};
    if (stage == ShaderStage::Vertex) m_vertexBufferSize = offset + size;
    else m_fragmentBufferSize = offset + size;
}

UniformLocation Program::getUniformLocation(const std::string& name) const {
    const auto found = m_uniforms.find(name);
    if (found == m_uniforms.end()) throw std::runtime_error("uniform not found: " + name);
    return found->second;
}

} // namespace backend
