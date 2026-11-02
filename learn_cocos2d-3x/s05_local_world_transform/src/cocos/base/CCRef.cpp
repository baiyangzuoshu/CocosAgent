#include "cocos/base/CCRef.h"
#include "cocos/base/CCAutoreleasePool.h"

#include <cassert>
#include <stdexcept>

namespace cocos2d {

Ref::Ref()
: _referenceCount(1) {
}

Ref::~Ref() = default;

void Ref::retain() {
    assert(_referenceCount > 0);
    ++_referenceCount;
}

void Ref::release() {
    assert(_referenceCount > 0);
    if (--_referenceCount == 0) {
        delete this;
    }
}

Ref* Ref::autorelease() {
    auto* pool = AutoreleasePool::current();
    if (!pool) {
        throw std::logic_error("create objects inside an AutoreleasePool");
    }
    pool->addObject(this);
    return this;
}

unsigned int Ref::getReferenceCount() const {
    return _referenceCount;
}

} // namespace cocos2d
