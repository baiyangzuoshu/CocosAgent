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
    void bufferData(const char* target, std::size_t bytes, const char* usage);
    void bufferSubData(const char* target, std::size_t offset, std::size_t bytes);
    void vertexPointer(int components, std::size_t stride, std::size_t offset);
    void colorPointer(int components, std::size_t stride, std::size_t offset);
    void texCoordPointer(int components, std::size_t stride, std::size_t offset);
    void drawElements(int indexCount, std::size_t indexByteOffset);
};

class CCTextureAtlas {
public:
    explicit CCTextureAtlas(GLDevice& gl);
    void updateQuad(const AtlasVertex (&quad)[4]);
    void drawNumberOfQuads(unsigned int count);

private:
    GLDevice& m_gl;
    std::vector<AtlasVertex> m_vertices;
    std::vector<unsigned short> m_indices;
    bool m_bDirty = false;
};
