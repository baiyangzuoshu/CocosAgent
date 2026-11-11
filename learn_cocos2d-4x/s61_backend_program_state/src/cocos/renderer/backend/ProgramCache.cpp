#include "ProgramCache.h"

#include <iostream>
#include <utility>

namespace backend {

Program& ProgramCache::getBuiltinProgram(const std::string& key) {
    auto found = m_programs.find(key);
    if (found != m_programs.end()) {
        std::cout << "ProgramCache hit: " << key << "\n";
        return *found->second;
    }

    auto program = std::unique_ptr<ProgramGL>(new ProgramGL());
    program->compileAndReflect("vertex shader", "fragment shader");
    ProgramGL& result = *program;
    m_programs.emplace(key, std::move(program));
    return result;
}

} // namespace backend
