#include "CCRenderer.h"

#include <iostream>

void Renderer::fillVerticesAndIndices(const TrianglesCommand& command, unsigned int vertexBufferOffset) {
    const unsigned int filledVertex = static_cast<unsigned int>(m_verts.size());
    const auto& vertices = command.getVertices();
    const auto& indices = command.getIndices();
    m_verts.insert(m_verts.end(), vertices.begin(), vertices.end());
    for (unsigned short index : indices) {
        m_indices.push_back(static_cast<unsigned short>(vertexBufferOffset + filledVertex + index));
    }
}

void Renderer::uploadBuffers() {
    if (m_verts.empty() || m_indices.empty()) return;
    m_vertexBuffer.updateData(m_verts.data(), sizeof(V3F_C4B_T2F) * m_verts.size());
    m_indexBuffer.updateData(m_indices.data(), sizeof(unsigned short) * m_indices.size());
    std::cout << "Renderer staging: vertices=" << m_verts.size()
              << " indices=" << m_indices.size() << "\n";
}
