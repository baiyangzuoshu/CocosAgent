#pragma once
#include "cocos2dx/label_nodes/CCLabelTTF.h"
#include <memory>

namespace cocos2d { namespace ui {
class Label {
 public:
  Label();
  void setText(const std::string& text);
  const std::string& getStringValue() const { return _labelRenderer->getString(); }
  CCSize getContentSize() const { return _labelRenderer->getContentSize(); }
  unsigned int getTextureGeneration() const { return _labelRenderer->getTextureGeneration(); }
 private:
  std::unique_ptr<CCLabelTTF> _labelRenderer;
};
}}
