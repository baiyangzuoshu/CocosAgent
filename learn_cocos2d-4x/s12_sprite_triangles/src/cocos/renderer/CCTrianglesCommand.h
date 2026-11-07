#pragma once

#include <cstdint>
#include <vector>

namespace cocos2d {
class TrianglesCommand {
public:
    struct Vertex { float x, y; };
    struct Triangles {
        std::vector<Vertex> vertices;
        std::vector<std::uint16_t> indices;
    };

    void init(const Triangles& triangles) { _triangles = triangles; }
    const Triangles& getTriangles() const { return _triangles; }

private:
    Triangles _triangles;
};
} // namespace cocos2d
