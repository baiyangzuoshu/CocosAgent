#pragma once

#include "CCNode.h"
#include <array>

namespace cocos2d {
class CCSpriteFrame;
class CCTexture2D;

class CCSprite : public CCNode {
public:
    using CCNode::CCNode;
    void setDisplayFrame(const CCSpriteFrame* frame);
    void draw() const override;

private:
    struct Vertex { float x, y, u, v; };
    std::array<Vertex, 4> _quad{{
        {-28, -28, 0, 0}, {28, -28, 1, 0}, {-28, 28, 0, 1}, {28, 28, 1, 1},
    }};
    CCTexture2D* _texture = nullptr;
};
} // namespace cocos2d
