#include "CCSprite.h"

CCSprite::CCSprite() : m_sQuad{} {}

void CCSprite::setTextureRect(float width, float height) {
    m_sQuad.bl.vertices = {0, 0, 0};
    m_sQuad.br.vertices = {width, 0, 0};
    m_sQuad.tl.vertices = {0, height, 0};
    m_sQuad.tr.vertices = {width, height, 0};
    m_sQuad.bl.texCoords = {0, 0};
    m_sQuad.br.texCoords = {1, 0};
    m_sQuad.tl.texCoords = {0, 1};
    m_sQuad.tr.texCoords = {1, 1};
}

void CCSprite::updateColor(ccColor4B color) {
    m_sQuad.bl.colors = color;
    m_sQuad.br.colors = color;
    m_sQuad.tl.colors = color;
    m_sQuad.tr.colors = color;
}

void CCSprite::draw() const {
    std::cout << "glVertexPointer(position)\n";
    std::cout << "glColorPointer(color)\n";
    std::cout << "glTexCoordPointer(uv)\n";
    std::cout << "glDrawArrays(GL_TRIANGLE_STRIP, 0, 4)\n";
    std::cout << "BL=(" << m_sQuad.bl.vertices.x << "," << m_sQuad.bl.vertices.y
              << ") rgba=(" << static_cast<int>(m_sQuad.bl.colors.r) << ","
              << static_cast<int>(m_sQuad.bl.colors.g) << ","
              << static_cast<int>(m_sQuad.bl.colors.b) << ","
              << static_cast<int>(m_sQuad.bl.colors.a) << ")\n";
}
