#pragma once

#include "CCTrianglesCommand.h"

#include <cstddef>
#include <vector>

class GLDevice {
public:
    void bufferData(const char* target, std::size_t bytes, const char* usage);
};

class Renderer {
public:
    explicit Renderer(GLDevice& gl) : m_gl(gl) {}
    void addCommand(const TrianglesCommand& command);
    void drawBatchedTriangles();

private:
    void fillVerticesAndIndices(const TrianglesCommand& command);

    GLDevice& m_gl;
    std::vector<TrianglesCommand> m_queuedTriangleCommands;
    std::vector<V3F_C4B_T2F> m_verts;
    std::vector<unsigned short> m_indices;
};
