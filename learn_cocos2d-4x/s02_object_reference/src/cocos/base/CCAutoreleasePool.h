#pragma once

#include <vector>

namespace cocos2d {

class Ref;

class AutoreleasePool {
public:
    AutoreleasePool();
    ~AutoreleasePool();

    void addObject(Ref* object);
    void clear();
    static AutoreleasePool* current();

private:
    static thread_local AutoreleasePool* _current;
    AutoreleasePool* _previous;
    std::vector<Ref*> _objects;
};

} // namespace cocos2d
