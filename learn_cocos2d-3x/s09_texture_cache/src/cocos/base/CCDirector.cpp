#include "cocos/base/CCDirector.h"

namespace cocos2d {

Director* Director::getInstance() {
    static Director director;
    return &director;
}

} // namespace cocos2d
