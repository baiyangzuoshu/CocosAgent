#include "CCSprite.h"
#include "../textures/CCTextureAtlas.h"

CCSprite::CCSprite(CCTextureAtlas& atlas, unsigned int atlasIndex)
    : m_atlas(atlas), m_uAtlasIndex(atlasIndex) {}

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
    m_atlas.updateQuad(m_sQuad, m_uAtlasIndex);
}
