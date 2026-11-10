#include "cocos/audio/include/AudioEngine.h"

int main() {
  const int id =
      cocos2d::experimental::AudioEngine::play2d("audio/click.wav");
  return id > 0 ? 0 : 1;
}
