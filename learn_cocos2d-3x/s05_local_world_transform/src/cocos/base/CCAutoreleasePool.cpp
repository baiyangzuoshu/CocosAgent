#include "cocos/base/CCAutoreleasePool.h"
#include "cocos/base/CCRef.h"

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

} // namespace cocos2d
