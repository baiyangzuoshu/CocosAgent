#include "extensions/CocoStudio/GUI/UIWidgets/UILabel.h"
namespace cocos2d { namespace ui {
Label::Label() : _labelRenderer(new CCLabelTTF()) {}
void Label::setText(const std::string& text) {
  _labelRenderer->setString(text.c_str());
}
}}
