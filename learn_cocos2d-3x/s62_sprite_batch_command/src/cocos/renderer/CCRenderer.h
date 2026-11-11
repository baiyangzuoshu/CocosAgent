#pragma once

#include "CCBatchCommand.h"

#include <vector>

class Renderer {
public:
    void addCommand(BatchCommand* command);
    void render();

private:
    std::vector<BatchCommand*> m_commands;
};
