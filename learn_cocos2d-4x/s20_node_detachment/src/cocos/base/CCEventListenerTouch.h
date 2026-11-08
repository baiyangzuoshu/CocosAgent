#pragma once
#include "CCEventTouch.h"
#include <functional>
namespace cocos2d {
class EventListenerTouchOneByOne {
public:
    std::function<bool(const Touch&)> onTouchBegan;
    void setSwallowTouches(bool value) { _swallow = value; }
    bool isSwallowTouches() const { return _swallow; }
private:
    bool _swallow = false;
};
}
