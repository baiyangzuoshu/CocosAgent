#pragma once

#include "cocos2dx/textures/CCTextureAtlas.h"

#include <string>
#include <vector>

struct CCSprite {
    CCSprite(const std::string& spriteName, const std::string& spriteTexture, int order)
        : name(spriteName), texture(spriteTexture), zOrder(order), atlasIndex(0) {}

    std::string name;
    std::string texture;
    int zOrder;
    unsigned int atlasIndex;
};

class CCSpriteBatchNode {
public:
    explicit CCSpriteBatchNode(const std::string& texture) : m_textureAtlas(texture) {}
    void addChild(CCSprite sprite);
    void visit();

private:
    CCTextureAtlas m_textureAtlas;
    std::vector<CCSprite> m_descendants;
};
