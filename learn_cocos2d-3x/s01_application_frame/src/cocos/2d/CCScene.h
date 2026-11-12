#pragma once

namespace cocos2d {

class Scene {
public:
    static Scene* create();

    void visit() const;
};

} // namespace cocos2d
