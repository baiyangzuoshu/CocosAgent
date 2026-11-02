#pragma once

#include "cocos2dx/include/CCNode.h"

namespace cocos2d {

class CCScene : public CCNode {
public:
    static CCScene* node();

protected:
    CCScene() = default;
    ~CCScene() override = default;
};

} // namespace cocos2d
