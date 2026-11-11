#pragma once

#include "cocos/renderer/backend/Program.h"

#include <string>

namespace backend {

class ProgramGL : public Program {
public:
    void compileAndReflect(const std::string& vertexSource, const std::string& fragmentSource);
};

} // namespace backend
