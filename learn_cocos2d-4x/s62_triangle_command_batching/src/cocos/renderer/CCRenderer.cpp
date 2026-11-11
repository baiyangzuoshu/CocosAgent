#include "CCRenderer.h"

#include <iostream>

void Renderer::processRenderCommand(const TrianglesCommand& command) {
    if (m_queuedIndices + command.getIndexCount() > m_maxIndices) {
        std::cout << "Renderer buffer capacity reached; flush queued commands\n";
        drawBatchedTriangles();
    }
    m_queuedCommands.push_back(command);
    m_queuedIndices += command.getIndexCount();
    std::cout << "Renderer queued: " << command.getName() << "\n";
}

void Renderer::flush() {
    drawBatchedTriangles();
}

void Renderer::drawBatchedTriangles() {
    if (m_queuedCommands.empty()) return;

    std::vector<DrawGroup> groups;
    std::string previousMaterial;
    bool firstCommand = true;
    std::size_t firstIndex = 0;

    for (const auto& command : m_queuedCommands) {
        std::cout << "fill shared buffers from " << command.getName() << "\n";
        const bool batchable = !command.isSkipBatching();
        if (batchable && (firstCommand || previousMaterial == command.getMaterialID())) {
            if (groups.empty()) groups.push_back({command.getMaterialID(), 0});
            groups.back().indexCount += command.getIndexCount();
        } else {
            groups.push_back({command.getMaterialID(), command.getIndexCount()});
        }
        previousMaterial = batchable ? command.getMaterialID() : "";
        firstCommand = false;
    }

    std::cout << "Renderer uploads shared vertex/index data once\n";
    for (const auto& group : groups) {
        m_commandBuffer.drawElements(group.materialId, group.indexCount, firstIndex);
        firstIndex += group.indexCount;
    }
    m_queuedCommands.clear();
    m_queuedIndices = 0;
}
