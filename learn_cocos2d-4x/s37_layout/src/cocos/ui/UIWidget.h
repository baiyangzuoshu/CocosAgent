#ifndef COURSE_4X_UIWIDGET_H
#define COURSE_4X_UIWIDGET_H

#include "UILayoutParameter.h"
#include <string>

namespace cocos2d { namespace ui {

struct Size { float width; float height; };
struct Vec2 { float x; float y; };

class Widget {
public:
  explicit Widget(std::string name, Size size)
      : _name(name), _size(size), _anchor{0.5f, 0.5f}, _position{0, 0} {}

  void setPosition(Vec2 position) { _position = position; }
  Vec2 getPosition() const { return _position; }
  void setAnchorPoint(Vec2 anchor) { _anchor = anchor; }
  Vec2 getAnchorPoint() const { return _anchor; }
  Size getContentSize() const { return _size; }
  Vec2 getRightBoundary() const {
    return {_position.x + (1.0f - _anchor.x) * _size.width, _position.y};
  }
  void setLayoutParameter(LinearLayoutParameter parameter) {
    _layoutParameter = parameter;
    _hasLayoutParameter = true;
  }
  LinearLayoutParameter* getLayoutParameter() {
    return _hasLayoutParameter ? &_layoutParameter : nullptr;
  }
  const std::string& getName() const { return _name; }

private:
  std::string _name;
  Size _size;
  Vec2 _anchor;
  Vec2 _position;
  LinearLayoutParameter _layoutParameter;
  bool _hasLayoutParameter = false;
};

}} // namespace cocos2d::ui

#endif
