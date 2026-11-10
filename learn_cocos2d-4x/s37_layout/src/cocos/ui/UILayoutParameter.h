#ifndef COURSE_4X_UILAYOUT_PARAMETER_H
#define COURSE_4X_UILAYOUT_PARAMETER_H

namespace cocos2d { namespace ui {

struct Margin {
  Margin(float l = 0, float t = 0, float r = 0, float b = 0)
      : left(l), top(t), right(r), bottom(b) {}
  float left;
  float top;
  float right;
  float bottom;
};

class LinearLayoutParameter {
public:
  enum class LinearGravity { NONE, TOP, CENTER_VERTICAL, BOTTOM };

  void setMargin(Margin margin) { _margin = margin; }
  Margin getMargin() const { return _margin; }
  void setGravity(LinearGravity gravity) { _gravity = gravity; }
  LinearGravity getGravity() const { return _gravity; }

private:
  Margin _margin;
  LinearGravity _gravity = LinearGravity::NONE;
};

}} // namespace cocos2d::ui

#endif
