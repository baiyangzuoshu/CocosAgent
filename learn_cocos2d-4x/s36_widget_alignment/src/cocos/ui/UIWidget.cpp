#include "cocos/ui/UIWidget.h"

namespace cocos2d { namespace ui {

void Widget::setPositionType(PositionType type) {
  _positionType = type;
}

void Widget::setPositionPercent(const Vec2& percent) {
  _positionPercent = percent;
}

void Widget::setContentSize(Size size) { _contentSize = size; }
Size Widget::getContentSize() const { return _contentSize; }
void Widget::setAnchorPoint(Vec2 anchor) { _anchorPoint = anchor; }
Vec2 Widget::getAnchorPoint() const { return _anchorPoint; }

void Widget::updateSizeAndPosition(const Size& parentSize) {
  if (_positionType == PositionType::PERCENT) {
    _position = {parentSize.width * _positionPercent.x,
                 parentSize.height * _positionPercent.y};
  }
}

Vec2 Widget::getPosition() const { return _position; }
Vec2 Widget::getPositionPercent() const { return _positionPercent; }

}} // namespace cocos2d::ui
