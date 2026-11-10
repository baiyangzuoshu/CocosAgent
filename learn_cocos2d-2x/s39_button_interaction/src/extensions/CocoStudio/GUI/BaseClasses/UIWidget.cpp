#include "extensions/CocoStudio/GUI/BaseClasses/UIWidget.h"
namespace cocos2d { namespace ui {
bool Widget::hitTest(Point p) const {
  return p.x >= _bounds.x && p.x <= _bounds.x + _bounds.width
      && p.y >= _bounds.y && p.y <= _bounds.y + _bounds.height;
}
void Widget::setFocused(bool focused) {
  if (_focused == focused) return;
  _focused = focused;
  if (_focused) onPressStateChangedToPressed();
  else onPressStateChangedToNormal();
}
bool Widget::onTouchBegan(Point point) {
  if (!_enabled || !_touchEnabled || !hitTest(point)) return false;
  setFocused(true);
  pushDownEvent();
  return true;
}
void Widget::onTouchMoved(Point point) {
  setFocused(hitTest(point));
  moveEvent();
}
void Widget::onTouchEnded() {
  const bool wasFocused = _focused;
  setFocused(false);
  if (wasFocused) releaseUpEvent(); else cancelUpEvent();
}
void Widget::onTouchCancelled() {
  setFocused(false);
  cancelUpEvent();
}
void Widget::pushDownEvent() { if (_touchCallback) _touchCallback(TOUCH_EVENT_BEGAN); }
void Widget::moveEvent() { if (_touchCallback) _touchCallback(TOUCH_EVENT_MOVED); }
void Widget::releaseUpEvent() { if (_touchCallback) _touchCallback(TOUCH_EVENT_ENDED); }
void Widget::cancelUpEvent() { if (_touchCallback) _touchCallback(TOUCH_EVENT_CANCELED); }
}}
