#pragma once
#include "cocos/2d/CCLabel.h"
#include <memory>
namespace cocos2d { namespace ui {
class Text {
 public:
  Text();
  void setString(const std::string& text);
  const std::string& getString() const { return _labelRenderer->getString(); }
  Size getContentSize() const { return _contentSize; }
  bool isAdaptDirty() const { return _labelRendererAdaptDirty; }
  void visit();
 private:
  void updateContentSizeWithTextureSize(Size size);
  std::unique_ptr<cocos2d::Label> _labelRenderer;
  Size _contentSize;
  bool _labelRendererAdaptDirty = false;
};
}}
