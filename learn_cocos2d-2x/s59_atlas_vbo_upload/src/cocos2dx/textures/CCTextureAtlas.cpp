#include "CCTextureAtlas.h"

#include <cstring>
#include <iostream>

void GLDevice::bindVertexArray() {
    std::cout << "ccGLBindVAO(TextureAtlas VAO)\n";
}

void GLDevice::bufferData(const char* target, std::size_t bytes, const void* data, const char* usage) {
    std::cout << "glBufferData " << target << " bytes=" << bytes
              << " data=" << (data ? "provided" : "null") << " usage=" << usage << "\n";
}

void* GLDevice::mapBuffer(const char* target, std::size_t bytes) {
    m_mapped.resize(bytes);
    std::cout << "glMapBuffer " << target << " bytes=" << bytes << "\n";
    return m_mapped.data();
}

void GLDevice::unmapBuffer(const char* target) {
    std::cout << "glUnmapBuffer " << target << "\n";
}

void GLDevice::vertexAttribPointer(const char* name, int components, std::size_t stride, std::size_t offset) {
    std::cout << "glVertexAttribPointer " << name << " components=" << components
              << " stride=" << stride << " offset=" << offset << "\n";
}

void GLDevice::drawElements(int indexCount, std::size_t indexByteOffset) {
    std::cout << "glDrawElements count=" << indexCount
              << " indexByteOffset=" << indexByteOffset << "\n";
}

CCTextureAtlas::CCTextureAtlas(GLDevice& gl) : m_gl(gl), m_vertices(4) {
    m_indices = {0, 1, 2, 3, 2, 1};
    m_gl.bindVertexArray();
    m_gl.bufferData("ARRAY_BUFFER", sizeof(AtlasVertex) * m_vertices.size(), m_vertices.data(), "DYNAMIC_DRAW");
    m_gl.bufferData("ELEMENT_ARRAY_BUFFER", sizeof(unsigned short) * m_indices.size(), m_indices.data(), "STATIC_DRAW");
    const std::size_t stride = sizeof(AtlasVertex);
    m_gl.vertexAttribPointer("position", 3, stride, offsetof(AtlasVertex, x));
    m_gl.vertexAttribPointer("color", 4, stride, offsetof(AtlasVertex, color));
    m_gl.vertexAttribPointer("texCoord", 2, stride, offsetof(AtlasVertex, u));
}

void CCTextureAtlas::updateQuad(const AtlasVertex (&quad)[4]) {
    for (int i = 0; i < 4; ++i) m_vertices[i] = quad[i];
    m_bDirty = true;
}

void CCTextureAtlas::drawNumberOfQuads(unsigned int count, unsigned int start) {
    if (count == 0) return;

    if (m_bDirty) {
        const std::size_t byteCount = sizeof(AtlasVertex) * count * 4;
        m_gl.bufferData("ARRAY_BUFFER", byteCount, nullptr, "DYNAMIC_DRAW");
        void* destination = m_gl.mapBuffer("ARRAY_BUFFER", byteCount);
        std::memcpy(destination, m_vertices.data(), byteCount);
        m_gl.unmapBuffer("ARRAY_BUFFER");
        m_bDirty = false;
    }

    m_gl.bindVertexArray();
    m_gl.drawElements(static_cast<int>(count * 6), start * 6 * sizeof(unsigned short));
}
