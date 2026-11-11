#include "CCRenderer.h"

#include <iostream>

void Renderer::addCommand(MeshCommand* command) {
    m_commands.push_back(command);
    std::cout << "Renderer.addCommand(MESH_COMMAND)\n";
}

void Renderer::inspectQueue() const {
    std::cout << "queued pass commands: " << m_commands.size() << "\n";
    for (const auto* command : m_commands) command->describe();
}
