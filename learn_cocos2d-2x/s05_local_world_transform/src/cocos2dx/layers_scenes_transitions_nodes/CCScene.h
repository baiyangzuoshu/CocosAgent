#pragma once

#include "cocos2dx/base_nodes/CCNode.h"

namespace cocos2d {

class CCScene : public CCNode {
public:
    static CCScene* create();

protected:
    CCScene() = default;
    ~CCScene() override = default;
};

} // namespace cocos2d
