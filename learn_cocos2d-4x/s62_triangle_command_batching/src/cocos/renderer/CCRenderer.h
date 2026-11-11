#pragma once

#include "CCRenderCommand.h"
#include "backend/CommandBuffer.h"

#include <cstddef>
#include <vector>

class Renderer {
public:
    explicit Renderer(std::size_t maxIndices = 18) : m_maxIndices(maxIndices) {}
    void processRenderCommand(const TrianglesCommand& command);
    void flush();

private:
    struct DrawGroup {
        DrawGroup(const std::string& id, std::size_t count) : materialId(id), indexCount(count) {}

        std::string materialId;
        std::size_t indexCount;
    };

    void drawBatchedTriangles();

    std::size_t m_maxIndices;
    std::size_t m_queuedIndices = 0;
    std::vector<TrianglesCommand> m_queuedCommands;
    backend::CommandBuffer m_commandBuffer;
};
