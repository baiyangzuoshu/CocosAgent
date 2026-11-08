#pragma once

#include "CCNode.h"
#include "../renderer/CCTrianglesCommand.h"

namespace cocos2d {
class SpriteFrame;

class Sprite : public Node {
public:
    using Node::Node;
    void setSpriteFrame(SpriteFrame* frame) { _spriteFrame = frame; }
    void draw(Renderer& renderer) const override;

private:
    SpriteFrame* _spriteFrame = nullptr;
};
} // namespace cocos2d
