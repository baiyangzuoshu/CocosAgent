#include "cocos/ui/UIWidget.h"

#include <iomanip>
#include <iostream>

using namespace cocos2d;
using namespace cocos2d::ui;

void printPosition(Widget& widget, Size parentSize) {
  widget.updateSizeAndPosition(parentSize);
  const Vec2 position = widget.getPosition();
  const Vec2 percent = widget.getPositionPercent();
  const float rightGap = parentSize.width - position.x
      - widget.getContentSize().width * (1.0f - widget.getAnchorPoint().x);
  std::cout << "parent=" << parentSize.width << "x" << parentSize.height
            << " percent=(" << percent.x << "," << percent.y << ")"
            << " center=(" << position.x << "," << position.y << ")"
            << " right-gap=" << rightGap << "\n";
}

int main() {
  Widget button;
  button.setContentSize({160, 64});
  button.setAnchorPoint({0.5f, 0.5f});
  button.setPositionType(Widget::PositionType::PERCENT);
  button.setPositionPercent({0.9f, 0.5f});

  std::cout << std::fixed << std::setprecision(1)
            << "ui::Widget maps percent position to parent size\n";
  printPosition(button, {960, 640});
  printPosition(button, {1280, 720});
  return 0;
}
