#pragma once

#include <cstddef>
#include <vector>

struct AtlasVertex {
    float x, y, z;
    unsigned char color[4];
    float u, v;
};

class GLDevice {
public:
    void bindVertexArray();
    void bufferData(const char* target, std::size_t bytes, const void* data, const char* usage);
    void* mapBuffer(const char* target, std::size_t bytes);
    void unmapBuffer(const char* target);
    void vertexAttribPointer(const char* name, int components, std::size_t stride, std::size_t offset);
    void drawElements(int indexCount, std::size_t indexByteOffset);

private:
    std::vector<unsigned char> m_mapped;
};

class CCTextureAtlas {
public:
    explicit CCTextureAtlas(GLDevice& gl);
    void updateQuad(const AtlasVertex (&quad)[4]);
    void drawNumberOfQuads(unsigned int count, unsigned int start = 0);

private:
    GLDevice& m_gl;
    std::vector<AtlasVertex> m_vertices;
    std::vector<unsigned short> m_indices;
    bool m_bDirty = false;
};
