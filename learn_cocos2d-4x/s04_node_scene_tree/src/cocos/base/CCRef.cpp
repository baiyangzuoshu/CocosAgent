#include "cocos/base/CCRef.h"

#include <cassert>
#include <stdexcept>
#include <utility>

namespace cocos2d {

thread_local AutoreleasePool* AutoreleasePool::_current = nullptr;

AutoreleasePool::AutoreleasePool()
: _previous(_current) {
    _current = this;
}

AutoreleasePool::~AutoreleasePool() {
    clear();
    _current = _previous;
}

void AutoreleasePool::addObject(Ref* object) {
    _objects.push_back(object);
}

void AutoreleasePool::clear() {
    std::vector<Ref*> releasing;
    releasing.swap(_objects);
    for (auto* object : releasing) {
        object->release();
    }
}

AutoreleasePool* AutoreleasePool::current() {
    return _current;
}

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
        throw std::logic_error("create Ref objects inside an AutoreleasePool");
    }
    pool->addObject(this);
    return this;
}

unsigned int Ref::getReferenceCount() const {
    return _referenceCount;
}

} // namespace cocos2d
