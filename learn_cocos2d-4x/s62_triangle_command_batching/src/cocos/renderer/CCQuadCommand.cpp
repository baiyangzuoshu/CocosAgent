#include "CCQuadCommand.h"

namespace {

std::string materialKey(
    const std::string& texture,
    ProgramKind program,
    const std::string& blend) {
    const std::string programName = program == ProgramKind::Builtin ? "builtin" : "custom";
    return texture + "|" + programName + "|" + blend;
}

} // namespace

QuadCommand::QuadCommand(
    const std::string& name,
    const std::string& texture,
    ProgramKind program,
    const std::string& blend,
    std::size_t quadCount)
    : TrianglesCommand(
          name,
          materialKey(texture, program, blend),
          quadCount * 6,
          program == ProgramKind::Custom) {}
