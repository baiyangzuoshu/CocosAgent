#include "CCSprite.h"
#include "../renderer/CCRenderer.h"

namespace cocos2d {

Sprite::Sprite() : m_command(new TrianglesCommand()) {}

Sprite::~Sprite() {
    delete m_command;
}

void Sprite::setTextureRect(float width, float height) {
    m_triangles.verts[0].x = 0;      m_triangles.verts[0].y = 0;
    m_triangles.verts[1].x = width; m_triangles.verts[1].y = 0;
    m_triangles.verts[2].x = 0;      m_triangles.verts[2].y = height;
    m_triangles.verts[3].x = width; m_triangles.verts[3].y = height;
    m_triangles.verts[0].u = 0; m_triangles.verts[0].v = 0;
    m_triangles.verts[1].u = 1; m_triangles.verts[1].v = 0;
    m_triangles.verts[2].u = 0; m_triangles.verts[2].v = 1;
    m_triangles.verts[3].u = 1; m_triangles.verts[3].v = 1;
}

void Sprite::updateColor(std::uint8_t r, std::uint8_t g, std::uint8_t b, std::uint8_t a) {
    for (auto& vertex : m_triangles.verts) {
        vertex.r = r; vertex.g = g; vertex.b = b; vertex.a = a;
    }
}

void Sprite::draw(Renderer& renderer, const std::string& transform) {
    m_command->init(m_globalZOrder, m_textureId, &m_programState, m_blend, m_triangles, transform);
    renderer.addCommand(m_command);
}

} // namespace cocos2d
