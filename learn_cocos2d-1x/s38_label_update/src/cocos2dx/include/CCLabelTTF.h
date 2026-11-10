#pragma once
#include "cocos2dx/include/CCSprite.h"
#include <string>
namespace cocos2d {
class CCLabelTTF : public CCSprite {
 public:
  void setString(const char* text);
  const std::string& getString() const { return _string; }
 private:
  std::string _string;
  std::string _fontName = "Arial";
  float _fontSize = 20;
};
}
