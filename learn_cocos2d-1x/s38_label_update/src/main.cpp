#include "cocos2dx/include/CCLabelTTF.h"
#include <iostream>

int main() {
  cocos2d::CCLabelTTF score;
  score.setString("Score 9");
  std::cout << score.getString() << ": texture#" << score.getTextureGeneration()
            << ", size=" << score.getContentSize().width << "x" << score.getContentSize().height << "\n";
  score.setString("Score 10");
  std::cout << score.getString() << ": texture#" << score.getTextureGeneration()
            << ", size=" << score.getContentSize().width << "x" << score.getContentSize().height << "\n";
}
