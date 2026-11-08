#pragma once

#include <string>

namespace cocos2d {
class CCTexture2D;

class CCSpriteFrame {
public:
    struct Rect { float x, y, width, height; };

    CCSpriteFrame(CCTexture2D* texture, Rect rect) : _texture(texture), _rect(rect) {}
    CCTexture2D* getTexture() const { return _texture; }
    const Rect& getRectInPixels() const { return _rect; }

private:
    CCTexture2D* _texture;
    Rect _rect;
};
} // namespace cocos2d
