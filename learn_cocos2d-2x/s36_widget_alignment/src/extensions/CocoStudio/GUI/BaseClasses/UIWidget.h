#ifndef COURSE_2X_UIWIDGET_H
#define COURSE_2X_UIWIDGET_H

#include "cocos2dx/base_nodes/CCNode.h"

namespace cocos2d { namespace ui {

enum PositionType { POSITION_ABSOLUTE, POSITION_PERCENT };

class Widget : public CCNode {
public:
  void setPositionType(PositionType type);
  void setPositionPercent(CCPoint percent);
  void updateSizeAndPosition(const CCSize& parentSize);
  CCPoint getPositionPercent() const;

private:
  PositionType _positionType = POSITION_ABSOLUTE;
  CCPoint _positionPercent{0, 0};
};

}} // namespace cocos2d::ui

#endif
