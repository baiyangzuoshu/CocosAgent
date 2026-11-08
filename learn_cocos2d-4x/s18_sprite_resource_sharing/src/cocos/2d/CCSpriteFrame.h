#pragma once

#include "../renderer/CCTextureCache.h"

namespace cocos2d {
class SpriteFrame {
public:
    struct Rect { float x, y, width, height; };

    SpriteFrame(Texture2D* texture, Rect rect) : _texture(texture), _rect(rect) {}
    Texture2D* getTexture() const { return _texture; }
    const Rect& getRect() const { return _rect; }

private:
    Texture2D* _texture;
    Rect _rect;
};
} // namespace cocos2d
