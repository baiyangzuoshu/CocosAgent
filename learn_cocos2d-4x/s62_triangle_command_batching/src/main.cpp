#include "cocos/renderer/CCQuadCommand.h"
#include "cocos/renderer/CCRenderer.h"

int main() {
    Renderer renderer;
    renderer.processRenderCommand(QuadCommand("sprite-a", "atlas-a", ProgramKind::Builtin, "alpha", 1));
    renderer.processRenderCommand(QuadCommand("sprite-b", "atlas-a", ProgramKind::Builtin, "alpha", 1));
    renderer.processRenderCommand(QuadCommand("sprite-c", "atlas-b", ProgramKind::Builtin, "alpha", 1));
    renderer.processRenderCommand(QuadCommand("custom", "atlas-a", ProgramKind::Custom, "alpha", 1));
    renderer.processRenderCommand(QuadCommand("sprite-d", "atlas-a", ProgramKind::Builtin, "alpha", 1));
    renderer.flush();
}
