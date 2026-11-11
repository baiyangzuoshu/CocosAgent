#pragma once

#include <array>
#include <cstdint>
#include <string>

namespace cocos2d {
namespace backend {
struct TextureBackend { int id = 42; };
struct BlendDescriptor {
    bool enabled = true;
    int source = 1;
    int destination = 771;
};
} // namespace backend

struct Vertex {
    float x = 0, y = 0, u = 0, v = 0;
    std::uint8_t r = 255, g = 255, b = 255, a = 255;
};
struct Triangles {
    std::array<Vertex, 4> verts{};
    std::array<unsigned short, 6> indices{{0, 1, 2, 1, 3, 2}};
};
struct BlendFunc { int src = 1, dst = 771; };

class Renderer;
class TrianglesCommand;

class Sprite {
public:
    Sprite();
    ~Sprite();
    void setTextureRect(float width, float height);
    void updateColor(std::uint8_t r, std::uint8_t g, std::uint8_t b, std::uint8_t a);
    void draw(Renderer& renderer, const std::string& transform);

private:
    Triangles m_triangles;
    TrianglesCommand* m_command = nullptr;
    backend::TextureBackend m_texture;
    BlendFunc m_blend;
};

} // namespace cocos2d
