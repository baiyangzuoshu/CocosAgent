#include "cocos2dx/label_nodes/CCLabelTTF.h"
namespace cocos2d {
void CCLabelTTF::setString(const char* text) {
  if (_string == text) return;
  _string = text;
  updateTexture();
}
bool CCLabelTTF::updateTexture() {
  CCTexture2D texture;
  if (!texture.initWithString(_string, _fontName, _fontSize)) return false;
  setTexture(texture);
  setTextureRect(_texture.getContentSize());
  return true;
}
}
