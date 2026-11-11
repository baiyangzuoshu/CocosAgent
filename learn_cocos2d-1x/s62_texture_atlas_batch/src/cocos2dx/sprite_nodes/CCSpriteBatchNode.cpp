#include "CCSpriteBatchNode.h"

#include <algorithm>
#include <iostream>
#include <stdexcept>
#include <utility>

void CCSpriteBatchNode::addChild(CCSprite sprite) {
    if (sprite.texture != m_textureAtlas.getTexture()) {
        throw std::invalid_argument("SpriteBatchNode children must use its texture");
    }

    const auto position = std::find_if(
        m_descendants.begin(),
        m_descendants.end(),
        [&sprite](const CCSprite& current) { return sprite.zOrder < current.zOrder; });
    const auto index = static_cast<unsigned int>(position - m_descendants.begin());
    sprite.atlasIndex = index;
    m_textureAtlas.insertQuad(sprite.name, index);
    m_descendants.insert(position, std::move(sprite));
    for (unsigned int i = index + 1; i < m_descendants.size(); ++i) {
        m_descendants[i].atlasIndex = i;
    }
}

void CCSpriteBatchNode::visit() {
    if (m_descendants.empty()) return;
    for (const auto& sprite : m_descendants) {
        std::cout << "updateTransform: " << sprite.name << "\n";
    }
    m_textureAtlas.printOrder();
    m_textureAtlas.drawQuads();
}
