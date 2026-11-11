#pragma once

#include "CCMeshCommand.h"

#include <vector>

class Renderer {
public:
    void addCommand(MeshCommand* command);
    void inspectQueue() const;

private:
    std::vector<MeshCommand*> m_commands;
};
