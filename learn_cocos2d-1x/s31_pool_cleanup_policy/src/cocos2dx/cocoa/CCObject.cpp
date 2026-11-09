#include "../include/CCObject.h"
#include <cassert>

namespace cocos2d {
void CCObject::retain() {
    assert(_referenceCount > 0);
    ++_referenceCount;
}

void CCObject::release() {
    assert(_referenceCount > 0);
    if (--_referenceCount == 0) delete this;
}
} // namespace cocos2d
