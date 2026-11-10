#pragma once

#include "cocos2dx/platform/CCEGLViewProtocol.h"

namespace cocos2d {

class CCDirector {
public:
  explicit CCDirector(const CCEGLViewProtocol& view);
  CCSize getWinSize() const;
  CCSize getVisibleSize() const;
  CCPoint getVisibleOrigin() const;

private:
  const CCEGLViewProtocol& _view;
};

} // namespace cocos2d
