#pragma once

namespace cocos2d {

class CCAutoreleasePool;

class CCObject {
public:
    CCObject();
    void retain();
    void release();
    CCObject* autorelease();
    unsigned int retainCount() const;

protected:
    virtual ~CCObject();

private:
    unsigned int _referenceCount;
};

} // namespace cocos2d
