#pragma once
#include <functional>
namespace cocos2d { namespace ui {
struct Vec2 { float x; float y; };
struct Rect { float x; float y; float width; float height; };
enum class TouchEventType { BEGAN, MOVED, ENDED, CANCELED };
class Widget {
 public:
  using TouchCallback = std::function<void(TouchEventType)>;
  using ClickCallback = std::function<void()>;
  explicit Widget(Rect bounds) : _bounds(bounds) {}
  virtual ~Widget() = default;
  void setTouchEnabled(bool value) { _touchEnabled = value; }
  void addTouchEventListener(const TouchCallback& callback) { _touchCallback = callback; }
  void addClickEventListener(const ClickCallback& callback) { _clickCallback = callback; }
  bool onTouchBegan(Vec2 point);
  void onTouchMoved(Vec2 point);
  void onTouchEnded();
  void onTouchCancelled();
  bool isHighlighted() const { return _highlight; }
 protected:
  virtual void onPressStateChangedToNormal() {}
  virtual void onPressStateChangedToPressed() {}
  virtual void onPressStateChangedToDisabled() {}
 private:
  bool hitTest(Vec2 point) const;
  void setHighlighted(bool value);
  void releaseUpEvent();
  void cancelUpEvent();
  Rect _bounds;
  TouchCallback _touchCallback;
  ClickCallback _clickCallback;
  bool _visible = true;
  bool _touchEnabled = false;
  bool _enabled = true;
  bool _highlight = false;
};
}}
