#pragma once

#include "cocos/renderer/CCBatchCommand.h"
#include "cocos/renderer/CCRenderer.h"

#include <string>
#include <vector>

struct Sprite {
    std::string name;
    std::string texture;
};

class SpriteBatchNode {
public:
    explicit SpriteBatchNode(std::string texture);
    void addChild(Sprite sprite);
    void draw(Renderer& renderer);

private:
    std::string m_texture;
    std::vector<Sprite> m_children;
    TextureAtlas m_textureAtlas;
    BatchCommand m_batchCommand;
};
