#include "CCGrid.h"

#include <iostream>
#include <stdexcept>

CCGrid3D::CCGrid3D(int columns, int rows)
    : m_columns(columns), m_rows(rows),
      m_vertices(static_cast<std::size_t>(columns + 1) * (rows + 1)) {
    for (int x = 0; x <= m_columns; ++x) {
        for (int y = 0; y <= m_rows; ++y) {
            m_vertices[static_cast<std::size_t>(x) * (m_rows + 1) + y] = {
                static_cast<float>(x), static_cast<float>(y), 0.0f};
        }
    }
    for (int x = 0; x < m_columns; ++x) {
        for (int y = 0; y < m_rows; ++y) {
            const std::uint16_t a = static_cast<std::uint16_t>(x * (m_rows + 1) + y);
            const std::uint16_t b = static_cast<std::uint16_t>((x + 1) * (m_rows + 1) + y);
            const std::uint16_t c = static_cast<std::uint16_t>((x + 1) * (m_rows + 1) + y + 1);
            const std::uint16_t d = static_cast<std::uint16_t>(x * (m_rows + 1) + y + 1);
            m_indices.insert(m_indices.end(), {a, b, d, b, c, d});
        }
    }
}

ccVertex3F CCGrid3D::vertex(const ccGridSize& position) const {
    if (position.x < 0 || position.x > m_columns || position.y < 0 || position.y > m_rows) {
        throw std::out_of_range("grid position");
    }
    const std::size_t index = static_cast<std::size_t>(position.x) * (m_rows + 1) + position.y;
    return m_vertices[index];
}

void CCGrid3D::setVertex(const ccGridSize& position, const ccVertex3F& value) {
    if (position.x < 0 || position.x > m_columns || position.y < 0 || position.y > m_rows) {
        throw std::out_of_range("grid position");
    }
    const std::size_t index = static_cast<std::size_t>(position.x) * (m_rows + 1) + position.y;
    m_vertices[index] = value;
}

void CCGrid3D::blit() const {
    std::cout << "CCGrid3D::blit -> glVertexPointer(position3f), glTexCoordPointer"
              << ", glDrawElements(GL_TRIANGLES, " << m_indices.size() << ")\n";
}
