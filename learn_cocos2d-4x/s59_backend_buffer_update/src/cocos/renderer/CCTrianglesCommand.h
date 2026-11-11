#pragma once

#include <vector>

struct V3F_C4B_T2F {
    float x, y, z;
    unsigned char color[4];
    float u, v;
};

class TrianglesCommand {
public:
    void setTriangles(std::vector<V3F_C4B_T2F> vertices, std::vector<unsigned short> indices);
    const std::vector<V3F_C4B_T2F>& getVertices() const { return m_vertices; }
    const std::vector<unsigned short>& getIndices() const { return m_indices; }

private:
    std::vector<V3F_C4B_T2F> m_vertices;
    std::vector<unsigned short> m_indices;
};
