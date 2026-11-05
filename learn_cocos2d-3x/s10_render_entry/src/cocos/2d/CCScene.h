#pragma once

#include "CCNode.h"

namespace cocos2d {
class Scene : public Node {
public:
    explicit Scene(Scheduler* scheduler, std::string name = "Scene")
        : Node(scheduler, std::move(name)) {}
};
} // namespace cocos2d
