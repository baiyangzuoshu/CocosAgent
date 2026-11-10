#include "cocos/ui/UIButton.h"
namespace cocos2d { namespace ui {
Button::Button(Rect bounds) : Widget(bounds) { setTouchEnabled(true); }
void Button::onPressStateChangedToNormal() { _visualState = "NORMAL"; }
void Button::onPressStateChangedToPressed() { _visualState = "PRESSED"; }
}}
