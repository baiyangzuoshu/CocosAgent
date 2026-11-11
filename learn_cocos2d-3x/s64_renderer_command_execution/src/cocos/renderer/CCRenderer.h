#pragma once

#include "CCMeshCommand.h"

#include <vector>

class Renderer {
public:
    void addCommand(RenderCommand* command);
    void render();

private:
    void processRenderCommand(RenderCommand* command);
    std::vector<RenderCommand*> _commands;
    int _lastBatchedMaterial = -1;
};
