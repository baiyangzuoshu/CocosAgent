#include "CCTextureAtlas.h"

#include <iostream>

void TextureAtlas::drawQuads() const {
    if (m_quadCount == 0) return;
    std::cout << "TextureAtlas draws " << m_quadCount << " quads\n";
}
