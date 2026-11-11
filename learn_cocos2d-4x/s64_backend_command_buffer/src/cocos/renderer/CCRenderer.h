#pragma once

#include "backend/CommandBuffer.h"

class MeshCommand {
public:
    MeshCommand(const char* program, const char* vertexBuffer, const char* indexBuffer, unsigned int indexCount)
        : program(program), vertexBuffer(vertexBuffer), indexBuffer(indexBuffer), indexCount(indexCount) {}
    const char* program;
    const char* vertexBuffer;
    const char* indexBuffer;
    unsigned int indexCount;
};

class Renderer {
public:
    explicit Renderer(CommandBuffer* commandBuffer);
    void render(MeshCommand* command);

private:
    void drawMeshCommand(MeshCommand* command);
    void drawCustomCommand(MeshCommand* command);
    CommandBuffer* _commandBuffer;
};
