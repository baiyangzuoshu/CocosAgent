#pragma once

#include <vector>

namespace cocos2d {

class CCObject;

class CCAutoreleasePool {
public:
    CCAutoreleasePool();
    ~CCAutoreleasePool();
    void addObject(CCObject* object);
    void clear();
    static CCAutoreleasePool* current();

private:
    static thread_local CCAutoreleasePool* _current;
    CCAutoreleasePool* _previous;
    std::vector<CCObject*> _objects;
};

} // namespace cocos2d
