#pragma once

#include "cocos/platform/CCGLView.h"

namespace cocos2d {

class Director {
public:
  void setOpenGLView(const GLView* view);
  const Size& getWinSize() const;
  Size getVisibleSize() const;
  Vec2 getVisibleOrigin() const;

private:
  const GLView* _openGLView = nullptr;
};

} // namespace cocos2d
