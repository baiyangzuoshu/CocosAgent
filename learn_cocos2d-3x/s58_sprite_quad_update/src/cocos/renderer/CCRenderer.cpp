#include "CCRenderer.h"

namespace cocos2d {

void Renderer::addCommand(TrianglesCommand* command) {
    m_command = command;
}

void Renderer::render() const {
    if (m_command) m_command->execute();
}

} // namespace cocos2d
