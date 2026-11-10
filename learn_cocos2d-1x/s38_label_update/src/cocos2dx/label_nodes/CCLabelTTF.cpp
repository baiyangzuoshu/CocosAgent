#include "cocos2dx/include/CCLabelTTF.h"
namespace cocos2d {
void CCLabelTTF::setString(const char* text) {
  _string = text;
  CCTexture2D texture;
  texture.initWithString(_string, _fontName, _fontSize);
  setTexture(texture);
  setTextureRect(_texture.getContentSize());
}
}
