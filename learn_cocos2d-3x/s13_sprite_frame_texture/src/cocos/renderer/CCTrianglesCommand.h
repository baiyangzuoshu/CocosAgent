#pragma once

#include "CCTextureCache.h"
#include <cstdint>
#include <vector>

namespace cocos2d {
class TrianglesCommand {
public:
    struct Vertex { float x, y, u, v; };
    struct Triangles {
        std::vector<Vertex> vertices;
        std::vector<std::uint16_t> indices;
    };

    void init(Texture2D* texture, const Triangles& triangles) { _texture = texture; _triangles = triangles; }
    Texture2D* getTexture() const { return _texture; }
    const Triangles& getTriangles() const { return _triangles; }

private:
    Texture2D* _texture = nullptr;
    Triangles _triangles;
};
} // namespace cocos2d
