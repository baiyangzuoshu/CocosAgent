#pragma once

#include "Program.h"

#include <vector>

namespace backend {

class ProgramState {
public:
    explicit ProgramState(Program& program);
    void setUniform(const UniformLocation& location, const void* data, std::size_t size);
    float readFirstFloat(const UniformLocation& location) const;

private:
    Program& m_program;
    std::vector<unsigned char> m_vertexUniforms;
    std::vector<unsigned char> m_fragmentUniforms;
};

} // namespace backend
