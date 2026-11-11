#include "CCTextureAtlas.h"

#include <iostream>

void GLDevice::bufferData(const char* target, std::size_t bytes, const char* usage) {
    std::cout << "glBufferData " << target << " bytes=" << bytes << " usage=" << usage << "\n";
}

void GLDevice::bufferSubData(const char* target, std::size_t offset, std::size_t bytes) {
    std::cout << "glBufferSubData " << target << " offset=" << offset << " bytes=" << bytes << "\n";
}

void GLDevice::vertexPointer(int components, std::size_t stride, std::size_t offset) {
    std::cout << "glVertexPointer components=" << components << " stride=" << stride
              << " offset=" << offset << "\n";
}

void GLDevice::colorPointer(int components, std::size_t stride, std::size_t offset) {
    std::cout << "glColorPointer components=" << components << " stride=" << stride
              << " offset=" << offset << "\n";
}

void GLDevice::texCoordPointer(int components, std::size_t stride, std::size_t offset) {
    std::cout << "glTexCoordPointer components=" << components << " stride=" << stride
              << " offset=" << offset << "\n";
}

void GLDevice::drawElements(int indexCount, std::size_t indexByteOffset) {
    std::cout << "glDrawElements count=" << indexCount
              << " indexByteOffset=" << indexByteOffset << "\n";
}

CCTextureAtlas::CCTextureAtlas(GLDevice& gl) : m_gl(gl), m_vertices(4) {
    m_indices = {0, 1, 2, 3, 2, 1};
    m_gl.bufferData("ARRAY_BUFFER", sizeof(AtlasVertex) * m_vertices.size(), "DYNAMIC_DRAW");
    m_gl.bufferData("ELEMENT_ARRAY_BUFFER", sizeof(unsigned short) * m_indices.size(), "STATIC_DRAW");
}

void CCTextureAtlas::updateQuad(const AtlasVertex (&quad)[4]) {
    for (int i = 0; i < 4; ++i) m_vertices[i] = quad[i];
    m_bDirty = true;
}

void CCTextureAtlas::drawNumberOfQuads(unsigned int count) {
    if (count == 0) return;

    if (m_bDirty) {
        m_gl.bufferSubData("ARRAY_BUFFER", 0, sizeof(AtlasVertex) * m_vertices.size());
        m_bDirty = false;
    }

    const std::size_t stride = sizeof(AtlasVertex);
    m_gl.vertexPointer(3, stride, offsetof(AtlasVertex, x));
    m_gl.colorPointer(4, stride, offsetof(AtlasVertex, color));
    m_gl.texCoordPointer(2, stride, offsetof(AtlasVertex, u));
    m_gl.drawElements(static_cast<int>(count * 6), 0);
}
