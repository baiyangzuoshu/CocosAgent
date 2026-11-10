#include "extensions/CocoStudio/GUI/UIWidgets/UIButton.h"
namespace cocos2d { namespace ui {
Button::Button(Rect bounds) : Widget(bounds) {}
bool Button::init() {
  setTouchEnabled(true);
  return true;
}
void Button::onPressStateChangedToNormal() { _visualState = "NORMAL"; }
void Button::onPressStateChangedToPressed() { _visualState = "PRESSED"; }
}}
