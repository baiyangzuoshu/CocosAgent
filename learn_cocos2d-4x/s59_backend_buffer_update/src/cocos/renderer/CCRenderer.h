#pragma once

#include "CCTrianglesCommand.h"
#include "backend/Buffer.h"

#include <vector>

class Renderer {
public:
    Renderer(backend::Buffer& vertexBuffer, backend::Buffer& indexBuffer)
        : m_vertexBuffer(vertexBuffer), m_indexBuffer(indexBuffer) {}

    void fillVerticesAndIndices(const TrianglesCommand& command, unsigned int vertexBufferOffset = 0);
    void uploadBuffers();

private:
    backend::Buffer& m_vertexBuffer;
    backend::Buffer& m_indexBuffer;
    std::vector<V3F_C4B_T2F> m_verts;
    std::vector<unsigned short> m_indices;
};
