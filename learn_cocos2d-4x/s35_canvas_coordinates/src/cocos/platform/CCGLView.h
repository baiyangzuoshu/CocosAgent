#pragma once

namespace cocos2d {

struct Size {
  float width;
  float height;
};

struct Vec2 {
  float x;
  float y;
};

struct Rect {
  float x;
  float y;
  float width;
  float height;
};

enum class ResolutionPolicy {
  SHOW_ALL,
};

class GLView {
public:
  GLView(float frameWidth, float frameHeight);
  void setDesignResolutionSize(float width, float height, ResolutionPolicy policy);
  const Size& getDesignResolutionSize() const;
  Size getVisibleSize() const;
  Vec2 getVisibleOrigin() const;
  Rect getViewPortRect() const;
  Vec2 convertToFrame(Vec2 point) const;

private:
  Size _screenSize;
  Size _designResolutionSize;
  float _scale = 1.0f;
  Rect _viewPortRect{0, 0, 0, 0};
};

} // namespace cocos2d
