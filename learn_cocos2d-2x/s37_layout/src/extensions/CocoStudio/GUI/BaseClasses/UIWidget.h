#ifndef COURSE_2X_UIWIDGET_H
#define COURSE_2X_UIWIDGET_H

#include "../Layouts/UILayoutParameter.h"
#include <string>

namespace cocos2d { namespace ui {

struct Size { float width; float height; };
struct Point { float x; float y; };

class Widget {
public:
  LinearLayoutParameter layoutParameter;

  explicit Widget(std::string name, Size size)
      : _name(name), _size(size), _anchor{0.5f, 0.5f}, _position{0, 0} {}

  Size getSize() const { return _size; }
  Point getAnchorPoint() const { return _anchor; }
  Point getPosition() const { return _position; }
  void setPosition(Point position) { _position = position; }
  void setAnchorPoint(Point anchor) { _anchor = anchor; }
  float getRightInParent() const {
    return _position.x + (1.0f - _anchor.x) * _size.width;
  }
  const std::string& getName() const { return _name; }

private:
  std::string _name;
  Size _size;
  Point _anchor;
  Point _position;
};

}} // namespace cocos2d::ui

#endif
