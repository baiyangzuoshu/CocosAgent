#include "cocos2dx/include/CCAutoreleasePool.h"
#include "cocos2dx/include/CCObject.h"

#include <utility>

namespace cocos2d {

thread_local CCAutoreleasePool* CCAutoreleasePool::_current = nullptr;

CCAutoreleasePool::CCAutoreleasePool()
: _previous(_current) {
    _current = this;
}

CCAutoreleasePool::~CCAutoreleasePool() {
    clear();
    _current = _previous;
}

void CCAutoreleasePool::addObject(CCObject* object) {
    _objects.push_back(object);
}

void CCAutoreleasePool::clear() {
    std::vector<CCObject*> releasing;
    releasing.swap(_objects);
    for (auto* object : releasing) {
        object->release();
    }
}

CCAutoreleasePool* CCAutoreleasePool::current() {
    return _current;
}

} // namespace cocos2d
