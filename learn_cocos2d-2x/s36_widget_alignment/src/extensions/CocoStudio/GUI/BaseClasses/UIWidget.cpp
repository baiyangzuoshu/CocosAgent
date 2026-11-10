#include "extensions/CocoStudio/GUI/BaseClasses/UIWidget.h"

namespace cocos2d { namespace ui {

void Widget::setPositionType(PositionType type) {
  _positionType = type;
}

void Widget::setPositionPercent(CCPoint percent) {
  _positionPercent = percent;
}

void Widget::updateSizeAndPosition(const CCSize& parentSize) {
  if (_positionType == POSITION_PERCENT) {
    setPosition({parentSize.width * _positionPercent.x,
                 parentSize.height * _positionPercent.y});
  }
}

CCPoint Widget::getPositionPercent() const {
  return _positionPercent;
}

}} // namespace cocos2d::ui
