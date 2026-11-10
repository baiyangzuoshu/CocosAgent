#pragma once
#include "cocos2dx/textures/CCTexture2D.h"
namespace cocos2d {
class CCSprite {
 public:
  void setTexture(const CCTexture2D& texture) { _texture = texture; }
  void setTextureRect(const CCSize& rect) { _contentSize = rect; }
  CCSize getContentSize() const { return _contentSize; }
  unsigned int getTextureGeneration() const { return _texture.getGeneration(); }
 protected:
  CCTexture2D _texture;
  CCSize _contentSize;
};
}
