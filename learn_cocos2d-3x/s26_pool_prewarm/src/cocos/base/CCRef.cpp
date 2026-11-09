#include "CCRef.h"
#include <cassert>

namespace cocos2d {
void Ref::retain() {
    assert(_referenceCount > 0);
    ++_referenceCount;
}

void Ref::release() {
    assert(_referenceCount > 0);
    if (--_referenceCount == 0) delete this;
}
} // namespace cocos2d
