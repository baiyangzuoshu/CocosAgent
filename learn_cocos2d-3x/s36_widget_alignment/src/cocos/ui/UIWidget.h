#ifndef COURSE_3X_UIWIDGET_H
#define COURSE_3X_UIWIDGET_H

namespace cocos2d {

struct Size { float width; float height; };
struct Vec2 { float x; float y; };

namespace ui {

class Widget {
public:
  enum class PositionType { ABSOLUTE, PERCENT };

  void setPositionType(PositionType type);
  void setPositionPercent(const Vec2& percent);
  void updateSizeAndPosition(const Size& parentSize);
  void setContentSize(Size size);
  Size getContentSize() const;
  void setAnchorPoint(Vec2 anchor);
  Vec2 getAnchorPoint() const;
  Vec2 getPosition() const;
  Vec2 getPositionPercent() const;

private:
  PositionType _positionType = PositionType::ABSOLUTE;
  Vec2 _position{0, 0};
  Vec2 _positionPercent{0, 0};
  Size _contentSize{0, 0};
  Vec2 _anchorPoint{0.5f, 0.5f};
};

} // namespace ui
} // namespace cocos2d

#endif
