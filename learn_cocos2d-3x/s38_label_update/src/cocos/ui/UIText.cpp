#include "cocos/ui/UIText.h"
namespace cocos2d { namespace ui {
Text::Text() : _labelRenderer(new cocos2d::Label()) {}
void Text::setString(const std::string& text) {
  if (text == _labelRenderer->getString()) return;
  _labelRenderer->setString(text);
  updateContentSizeWithTextureSize(_labelRenderer->getContentSize());
  _labelRendererAdaptDirty = true;
}
void Text::updateContentSizeWithTextureSize(Size size) { _contentSize = size; }
void Text::visit() {
  // Widget::visit 先 adaptRenderers，再访问 ProtectedNode 子节点。
  if (_labelRendererAdaptDirty) _labelRendererAdaptDirty = false;
  _labelRenderer->visit();
}
}}
