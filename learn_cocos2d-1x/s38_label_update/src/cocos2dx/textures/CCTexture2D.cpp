#include "cocos2dx/include/CCTexture2D.h"
namespace cocos2d {
namespace { unsigned int nextTextureGeneration = 0; }
bool CCTexture2D::initWithString(const std::string& text, const std::string&, float size) {
  _size = CCSize(static_cast<float>(text.size()) * size * 0.6f, size * 1.2f);
  _generation = ++nextTextureGeneration;
  return true;
}
}
