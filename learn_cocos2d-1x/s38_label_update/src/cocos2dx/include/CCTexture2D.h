#pragma once
#include <string>
namespace cocos2d {
struct CCSize {
  float width; float height;
  CCSize(float w = 0, float h = 0) : width(w), height(h) {}
};
class CCTexture2D {
 public:
  bool initWithString(const std::string& text, const std::string& font, float size);
  CCSize getContentSize() const { return _size; }
  unsigned int getGeneration() const { return _generation; }
 private:
  CCSize _size;
  unsigned int _generation = 0;
};
}
