#pragma once
#include "CCEventTouch.h"
#include <functional>
namespace cocos2d {
class EventListenerTouchOneByOne {
public:
    std::function<bool(const Touch&)> onTouchBegan;
};
}
