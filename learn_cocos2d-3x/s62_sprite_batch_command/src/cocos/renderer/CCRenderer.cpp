#include "CCRenderer.h"

#include <iostream>

void Renderer::addCommand(BatchCommand* command) {
    m_commands.push_back(command);
    std::cout << "Renderer queued one BatchCommand\n";
}

void Renderer::render() {
    for (const BatchCommand* command : m_commands) command->execute();
    m_commands.clear();
}
