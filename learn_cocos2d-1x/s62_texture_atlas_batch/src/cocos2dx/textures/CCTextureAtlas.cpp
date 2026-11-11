#include "CCTextureAtlas.h"

#include <iostream>

void CCTextureAtlas::insertQuad(const std::string& sprite, std::size_t index) {
    if (index > m_quads.size()) index = m_quads.size();
    m_quads.insert(m_quads.begin() + static_cast<std::ptrdiff_t>(index), sprite);
    std::cout << "TextureAtlas inserted " << sprite << " at " << index << "\n";
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
