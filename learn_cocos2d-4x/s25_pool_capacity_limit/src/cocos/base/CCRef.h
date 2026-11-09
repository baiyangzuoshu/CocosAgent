#pragma once

namespace cocos2d {
class Ref {
public:
    Ref() = default;
    virtual ~Ref() = default;
    void retain();
    void release();
    unsigned int retainCount() const { return _referenceCount; }

private:
    unsigned int _referenceCount = 1;
};
} // namespace cocos2d
