#include "cocos/ui/UIWidget.h"
namespace cocos2d { namespace ui {
bool Widget::hitTest(Vec2 p) const {
  return p.x >= _bounds.x && p.x <= _bounds.x + _bounds.width
      && p.y >= _bounds.y && p.y <= _bounds.y + _bounds.height;
}
void Widget::setHighlighted(bool value) {
  if (_highlight == value) return;
  _highlight = value;
  if (_highlight) onPressStateChangedToPressed();
  else onPressStateChangedToNormal();
}
bool Widget::onTouchBegan(Vec2 point) {
  if (!_visible || !_enabled || !_touchEnabled || !hitTest(point)) return false;
  setHighlighted(true);
  if (_touchCallback) _touchCallback(TouchEventType::BEGAN);
  return true;
}
void Widget::onTouchMoved(Vec2 point) {
  setHighlighted(hitTest(point));
  if (_touchCallback) _touchCallback(TouchEventType::MOVED);
}
void Widget::onTouchEnded() {
  const bool wasHighlighted = _highlight;
  setHighlighted(false);
  if (wasHighlighted) releaseUpEvent(); else cancelUpEvent();
}
void Widget::onTouchCancelled() {
  setHighlighted(false);
  cancelUpEvent();
}
void Widget::releaseUpEvent() {
  if (_touchCallback) _touchCallback(TouchEventType::ENDED);
  if (_clickCallback) _clickCallback();
}
void Widget::cancelUpEvent() {
  if (_touchCallback) _touchCallback(TouchEventType::CANCELED);
}
}}
