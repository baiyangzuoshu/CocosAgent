#include "CCSpriteBatchNode.h"

#include <iostream>
#include <stdexcept>
#include <utility>

SpriteBatchNode::SpriteBatchNode(std::string texture)
    : m_texture(std::move(texture)), m_textureAtlas(m_texture, 0) {}

void SpriteBatchNode::addChild(Sprite sprite) {
    if (sprite.texture != m_texture) throw std::invalid_argument("batch children need the same texture");
    m_children.push_back(std::move(sprite));
    m_textureAtlas = TextureAtlas(m_texture, m_children.size());
}

void SpriteBatchNode::draw(Renderer& renderer) {
    if (m_textureAtlas.getTotalQuads() == 0) return;
    for (const auto& child : m_children) std::cout << "updateTransform: " << child.name << "\n";
    m_batchCommand.init("position-texture-color", "alpha", m_textureAtlas);
    renderer.addCommand(&m_batchCommand);
}
