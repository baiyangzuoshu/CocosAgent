#include "cocos2dx/include/CCObject.h"
#include "cocos2dx/include/CCAutoreleasePool.h"

#include <cassert>
#include <stdexcept>

namespace cocos2d {

CCObject::CCObject()
: _referenceCount(1) {
}

CCObject::~CCObject() = default;

void CCObject::retain() {
    assert(_referenceCount > 0);
    ++_referenceCount;
}

void CCObject::release() {
    assert(_referenceCount > 0);
    if (--_referenceCount == 0) {
        delete this;
    }
}

CCObject* CCObject::autorelease() {
    auto* pool = CCAutoreleasePool::current();
    if (!pool) {
        throw std::logic_error("create objects inside an AutoreleasePool");
    }
    pool->addObject(this);
    return this;
}

unsigned int CCObject::retainCount() const {
    return _referenceCount;
}

} // namespace cocos2d
