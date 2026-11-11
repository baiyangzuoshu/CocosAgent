#include "CCSpriteBatchNode.h"

#include <algorithm>
#include <iostream>
#include <stdexcept>
#include <utility>

void CCSpriteBatchNode::addChild(CCSprite sprite) {
    if (sprite.texture != m_textureAtlas.getTexture()) {
        throw std::invalid_argument("SpriteBatchNode children must use its texture");
    }
    sprite.atlasIndex = static_cast<unsigned int>(m_children.size());
    m_textureAtlas.appendQuad(sprite.name);
    m_children.push_back(std::move(sprite));
    m_reorderChildDirty = true;
}

void CCSpriteBatchNode::sortAllChildren() {
    if (!m_reorderChildDirty) return;
    std::stable_sort(
        m_children.begin(),
        m_children.end(),
        [](const CCSprite& left, const CCSprite& right) { return left.zOrder < right.zOrder; });

    std::vector<std::string> order;
    order.reserve(m_children.size());
    for (unsigned int index = 0; index < m_children.size(); ++index) {
        m_children[index].atlasIndex = index;
        order.push_back(m_children[index].name);
    }
    m_textureAtlas.reorderQuads(order);
    m_reorderChildDirty = false;
}

void CCSpriteBatchNode::visit() {
    sortAllChildren();
    for (const auto& sprite : m_children) {
        std::cout << "updateTransform: " << sprite.name
                  << " atlasIndex=" << sprite.atlasIndex << "\n";
    }
    m_textureAtlas.printOrder();
    m_textureAtlas.drawQuads();
}
