#include "CCTrianglesCommand.h"

#include <utility>

void TrianglesCommand::setTriangles(
    std::vector<V3F_C4B_T2F> vertices,
    std::vector<unsigned short> indices) {
    m_vertices = std::move(vertices);
    m_indices = std::move(indices);
}
