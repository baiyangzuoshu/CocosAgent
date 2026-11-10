#pragma once

#include "cocos2dx/CCDirector.h"

namespace cocos2d {

class CCLayer {
public:
  bool init(const CCDirector& director);
  CCSize getContentSize() const;

private:
  CCSize _contentSize{0, 0};
};

} // namespace cocos2d
