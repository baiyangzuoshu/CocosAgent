#include "extensions/CocoStudio/GUI/UIWidgets/UILabel.h"
#include <iostream>
int main() {
  cocos2d::ui::Label score;
  score.setText("Score 9");
  std::cout << score.getStringValue() << ": texture#" << score.getTextureGeneration()
            << ", width=" << score.getContentSize().width << "\n";
  score.setText("Score 10");
  std::cout << score.getStringValue() << ": texture#" << score.getTextureGeneration()
            << ", width=" << score.getContentSize().width << "\n";
}
