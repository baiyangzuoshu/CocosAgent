#pragma once

#include "../base_nodes/CCNode.h"

namespace cocos2d {
class CCScene : public CCNode {
public:
    explicit CCScene(CCScheduler* scheduler, std::string name = "Scene")
        : CCNode(scheduler, std::move(name)) {}
};
} // namespace cocos2d
