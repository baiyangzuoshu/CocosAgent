#pragma once

#include "CCNode.h"

namespace cocos2d {
class CCScene : public CCNode {
public:
    explicit CCScene(std::string name = "Scene") : CCNode(std::move(name)) {}
};
} // namespace cocos2d
