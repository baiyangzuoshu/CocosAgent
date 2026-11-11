#include "CCBatchCommand.h"

#include <iostream>
#include <stdexcept>

void BatchCommand::init(const std::string& shader, const std::string& blend, TextureAtlas& atlas) {
    if (atlas.getTotalQuads() == 0) throw std::invalid_argument("batch atlas is empty");
    m_shader = shader;
    m_blend = blend;
    m_texture = atlas.getTexture();
    m_textureAtlas = &atlas;
    std::cout << "BatchCommand captures shader, texture and blend\n";
}

void BatchCommand::execute() const {
    if (!m_textureAtlas) return;
    std::cout << "BatchCommand use shader " << m_shader << "\n";
    std::cout << "BatchCommand bind texture " << m_texture << " and blend " << m_blend << "\n";
    m_textureAtlas->drawQuads();
}
