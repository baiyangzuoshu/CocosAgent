#pragma once

namespace cocos2d {

class AutoreleasePool;

class Ref {
public:
    Ref();
    void retain();
    void release();
    Ref* autorelease();
    unsigned int getReferenceCount() const;

protected:
    virtual ~Ref();

private:
    unsigned int _referenceCount;
};

} // namespace cocos2d
