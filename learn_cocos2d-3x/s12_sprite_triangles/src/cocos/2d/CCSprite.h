#pragma once

#include "CCNode.h"
#include "../renderer/CCTrianglesCommand.h"

namespace cocos2d {
class Sprite : public Node {
public:
    using Node::Node;
    void draw(Renderer& renderer) const override;
};
} // namespace cocos2d
