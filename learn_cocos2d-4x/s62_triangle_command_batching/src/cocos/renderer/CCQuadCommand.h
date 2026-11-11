#pragma once

#include "CCRenderCommand.h"

#include <string>

enum class ProgramKind { Builtin, Custom };

class QuadCommand : public TrianglesCommand {
public:
    QuadCommand(
        const std::string& name,
        const std::string& texture,
        ProgramKind program,
        const std::string& blend,
        std::size_t quadCount);
};
