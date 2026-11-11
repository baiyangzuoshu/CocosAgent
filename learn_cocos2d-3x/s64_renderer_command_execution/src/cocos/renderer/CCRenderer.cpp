#include "CCRenderer.h"

#include <algorithm>
#include <iostream>

void Renderer::addCommand(RenderCommand* command) {
    _commands.push_back(command);
    std::cout << "Renderer.addCommand order=" << command->getGlobalOrder() << "\n";
}

void Renderer::render() {
    std::sort(_commands.begin(), _commands.end(), [](const RenderCommand* a, const RenderCommand* b) {
        return a->getGlobalOrder() < b->getGlobalOrder();
    });
    std::cout << "Renderer.render -> sort and visit render queue\n";
    for (RenderCommand* command : _commands) processRenderCommand(command);
    _commands.clear();
}

void Renderer::processRenderCommand(RenderCommand* command) {
    auto* mesh = static_cast<MeshCommand*>(command);
    std::cout << "Renderer.processRenderCommand(MESH_COMMAND)\n";
    std::cout << "flush2D before 3D command\n";
    if (mesh->isSkipBatching()) {
        std::cout << "flush3D before skip-batching command\n";
        mesh->execute();
    } else if (mesh->getMaterialID() != _lastBatchedMaterial) {
        std::cout << "flush3D at material boundary\n";
        mesh->batchDraw();
        _lastBatchedMaterial = mesh->getMaterialID();
    } else {
        mesh->batchDraw();
    }
}
