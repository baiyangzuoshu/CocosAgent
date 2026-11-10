#ifndef COURSE_2X_UILAYOUT_PARAMETER_H
#define COURSE_2X_UILAYOUT_PARAMETER_H

namespace cocos2d { namespace ui {

struct Margin {
  float left;
  float top;
  float right;
  float bottom;
};

enum LinearGravity {
  LINEAR_GRAVITY_NONE,
  LINEAR_GRAVITY_CENTER_VERTICAL
};

class LinearLayoutParameter {
public:
  Margin margin{0, 0, 0, 0};
  LinearGravity gravity = LINEAR_GRAVITY_NONE;
};

}} // namespace cocos2d::ui

#endif
