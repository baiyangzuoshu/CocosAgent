#pragma once

#include "cocos/renderer/CCTextureCache.h"

namespace cocos2d {

class Director {
public:
    static Director* getInstance();
    TextureCache* getTextureCache() { return &_textureCache; }

private:
    TextureCache _textureCache;
};

} // namespace cocos2d
