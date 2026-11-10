#pragma once

namespace cocos2d {

struct CCSize {
  float width;
  float height;
};

struct CCPoint {
  float x;
  float y;
};

struct CCRect {
  float x;
  float y;
  float width;
  float height;
};

enum ResolutionPolicy {
  kResolutionShowAll,
};

class CCEGLViewProtocol {
public:
  CCEGLViewProtocol(float frameWidth, float frameHeight);
  void setDesignResolutionSize(float width, float height, ResolutionPolicy policy);
  CCSize getDesignResolutionSize() const;
  CCSize getVisibleSize() const;
  CCPoint getVisibleOrigin() const;
  CCRect getViewPortRect() const;
  CCPoint convertToFrame(CCPoint point) const;

private:
  CCSize _frameSize;
  CCSize _designSize;
  float _scale = 1.0f;
  CCRect _viewport{0, 0, 0, 0};
};

} // namespace cocos2d
