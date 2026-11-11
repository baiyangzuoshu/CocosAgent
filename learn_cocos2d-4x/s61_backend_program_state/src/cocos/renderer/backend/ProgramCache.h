#pragma once

#include "opengl/ProgramGL.h"

#include <memory>
#include <string>
#include <unordered_map>

namespace backend {

class ProgramCache {
public:
    Program& getBuiltinProgram(const std::string& key);

private:
    std::unordered_map<std::string, std::unique_ptr<ProgramGL>> m_programs;
};

} // namespace backend
