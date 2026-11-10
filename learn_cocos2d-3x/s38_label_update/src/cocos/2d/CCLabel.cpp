#include "cocos/2d/CCLabel.h"
namespace cocos2d {
void Label::setString(const std::string& text) {
  if (text == _utf8Text) return;
  _utf8Text = text;
  _contentDirty = true;
  // 源码还会把 UTF-8 文本解码成 UTF-32，供字形排版使用。
}
Size Label::getContentSize() const {
  if (_contentDirty) const_cast<Label*>(this)->updateContent();
  return _contentSize;
}
void Label::updateContent() {
  _contentSize = {static_cast<float>(_utf8Text.size()) * 12.0f, 24.0f};
  ++_contentRevision;
  _contentDirty = false;
}
void Label::visit() {
  if (_contentDirty) updateContent();
}
}
