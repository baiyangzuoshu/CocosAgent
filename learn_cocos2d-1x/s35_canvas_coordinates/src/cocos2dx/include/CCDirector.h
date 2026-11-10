#pragma once

namespace cocos2d {

struct CCSize {
  float width;
  float height;
};

class CCDirector {
public:
  CCDirector(float width, float height, float contentScaleFactor);
  CCSize getWinSize() const;
  CCSize getWinSizeInPixels() const;

private:
  CCSize _winSizeInPoints;
  float _contentScaleFactor;
};

} // namespace cocos2d
