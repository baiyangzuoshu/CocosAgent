#pragma once

#include <cstddef>
#include <string>
#include <unordered_map>

namespace backend {

enum class ShaderStage { Vertex, Fragment };

struct UniformLocation {
    ShaderStage stage;
    std::size_t offset;
    std::string name;
};

class Program {
public:
    virtual ~Program() = default;
    UniformLocation getUniformLocation(const std::string& name) const;
    std::size_t vertexUniformBufferSize() const { return m_vertexBufferSize; }
    std::size_t fragmentUniformBufferSize() const { return m_fragmentBufferSize; }

protected:
    void addUniform(const std::string& name, ShaderStage stage, std::size_t offset, std::size_t size);

private:
    std::unordered_map<std::string, UniformLocation> m_uniforms;
    std::size_t m_vertexBufferSize = 0;
    std::size_t m_fragmentBufferSize = 0;
};

} // namespace backend
