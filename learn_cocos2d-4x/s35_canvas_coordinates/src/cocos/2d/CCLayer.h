#pragma once

#include "cocos/base/CCDirector.h"

namespace cocos2d {

class Layer {
public:
  bool init(const Director& director);
  Size getContentSize() const;

private:
  Size _contentSize{0, 0};
};

} // namespace cocos2d
