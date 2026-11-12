#pragma once

namespace cocos2d {

class CCScene {
public:
    static CCScene* create();

    void visit() const;
};

} // namespace cocos2d
