#include "CCTextureAtlas.h"

#include <iostream>

void CCTextureAtlas::appendQuad(const std::string& sprite) {
    m_quads.push_back(sprite);
}

void CCTextureAtlas::reorderQuads(const std::vector<std::string>& order) {
    m_quads = order;
    std::cout << "TextureAtlas reordered its quad array\n";
}

void CCTextureAtlas::drawQuads() const {
    if (m_quads.empty()) return;
    std::cout << "TextureAtlas binds " << m_texture << "\n";
    std::cout << "TextureAtlas draws " << m_quads.size() << " quads in one call\n";
}

void CCTextureAtlas::printOrder() const {
    std::cout << "atlas order:";
    for (const auto& sprite : m_quads) std::cout << " " << sprite;
    std::cout << "\n";
}
