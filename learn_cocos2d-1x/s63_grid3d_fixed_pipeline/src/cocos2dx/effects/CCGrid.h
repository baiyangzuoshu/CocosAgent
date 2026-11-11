#pragma once

#include <cstddef>
#include <cstdint>
#include <vector>

struct ccGridSize {
    int x;
    int y;
};

struct ccVertex3F {
    float x;
    float y;
    float z;
};

class CCGrid3D {
public:
    CCGrid3D(int columns, int rows);
    ccVertex3F vertex(const ccGridSize& position) const;
    void setVertex(const ccGridSize& position, const ccVertex3F& value);
    void blit() const;

private:
    int m_columns;
    int m_rows;
    std::vector<ccVertex3F> m_vertices;
    std::vector<std::uint16_t> m_indices;
};
