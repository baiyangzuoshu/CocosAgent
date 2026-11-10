#pragma once
#include "cocos/ui/UIWidget.h"
#include <string>
namespace cocos2d { namespace ui {
class Button : public Widget {
 public:
  explicit Button(Rect bounds);
  const std::string& getVisualState() const { return _visualState; }
 protected:
  void onPressStateChangedToNormal() override;
  void onPressStateChangedToPressed() override;
 private:
  std::string _visualState = "NORMAL";
};
}}
