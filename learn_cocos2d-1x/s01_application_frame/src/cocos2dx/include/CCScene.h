#pragma once

namespace cocos2d {

class CCScene {
public:
    static CCScene* node();

    void visit() const;
};

} // namespace cocos2d
