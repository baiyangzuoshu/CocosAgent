#pragma once

#include <string>

namespace CocosDenshion {

class MciPlayer {
public:
  void Open(const std::string& path, unsigned int soundId);
  void Play(bool loop);

private:
  std::string _path;
  unsigned int _soundId = 0;
};

}
