#include "cocos2dx/include/CCNode.h"

#include <iomanip>
#include <iostream>

using namespace cocos2d;

void alignRightCenter(CCNode& child, const CCNode& parent, float rightMargin) {
  const CCSize parentSize = parent.getContentSize();
  const CCSize childSize = child.getContentSize();
  const CCPoint childAnchor = child.getAnchorPoint();
  const float rightEdge = parentSize.width - rightMargin;
  const float x = rightEdge + (childAnchor.x - 1.0f) * childSize.width;
  const float y = parentSize.height / 2.0f
      + (childAnchor.y - 0.5f) * childSize.height;
  child.setPosition({x, y});
}

void printPosition(const CCNode& root, const CCNode& child) {
  const CCPoint rootPosition = root.getPosition();
  const CCPoint localPosition = child.getPosition();
  std::cout << "local=" << localPosition.x << "," << localPosition.y
            << " center=" << rootPosition.x + localPosition.x << ","
            << rootPosition.y + localPosition.y << "\n";
}

int main() {
  CCNode root;
  root.setContentSize({960, 640});
  root.setPosition({0, 0});

  CCNode item;
  item.setAnchorPoint({0.5f, 0.5f});
  item.setContentSize({160, 64});

  std::cout << std::fixed << std::setprecision(1)
            << "CCNode anchor math (application code; no built-in Widget)\n";
  alignRightCenter(item, root, 24);
  printPosition(root, item);

  root.setContentSize({1280, 720});
  alignRightCenter(item, root, 24);
  printPosition(root, item);
  return 0;
}
