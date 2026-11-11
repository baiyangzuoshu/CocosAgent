#include "CCRenderer.h"

#include <iostream>

void GLDevice::bufferData(const char* target, std::size_t bytes, const char* usage) {
    std::cout << "glBufferData " << target << " bytes=" << bytes << " usage=" << usage << "\n";
}

void Renderer::addCommand(const TrianglesCommand& command) {
    m_queuedTriangleCommands.push_back(command);
}

void Renderer::fillVerticesAndIndices(const TrianglesCommand& command) {
    const auto& vertices = command.getVertices();
    const auto& indices = command.getIndices();
    const unsigned short vertexOffset = static_cast<unsigned short>(m_verts.size());
    m_verts.insert(m_verts.end(), vertices.begin(), vertices.end());
    for (unsigned short index : indices) {
        m_indices.push_back(vertexOffset + index);
    }
}

void Renderer::drawBatchedTriangles() {
    if (m_queuedTriangleCommands.empty()) return;

    m_verts.clear();
    m_indices.clear();
    for (const TrianglesCommand& command : m_queuedTriangleCommands) {
        fillVerticesAndIndices(command);
    }

    m_gl.bufferData("ARRAY_BUFFER", sizeof(V3F_C4B_T2F) * m_verts.size(), "DYNAMIC_DRAW");
    m_gl.bufferData("ELEMENT_ARRAY_BUFFER", sizeof(unsigned short) * m_indices.size(), "STATIC_DRAW");
    std::cout << "Renderer staging: vertices=" << m_verts.size()
              << " indices=" << m_indices.size() << "\n";
    m_queuedTriangleCommands.clear();
}
