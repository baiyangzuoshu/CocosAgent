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

class Ref {
public:
    void retain();
    void release();
    Ref* autorelease();
    unsigned int getReferenceCount() const;

protected:
    Ref();
    virtual ~Ref();

private:
    unsigned int _referenceCount;
};

} // namespace cocos2d
