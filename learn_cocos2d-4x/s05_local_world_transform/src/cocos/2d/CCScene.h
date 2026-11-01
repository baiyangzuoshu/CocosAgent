#pragma once

#include "cocos/2d/CCNode.h"

namespace cocos2d {

class Scene : public Node {
public:
    static Scene* create();

protected:
    Scene();
    ~Scene() override = default;
};

} // namespace cocos2d
