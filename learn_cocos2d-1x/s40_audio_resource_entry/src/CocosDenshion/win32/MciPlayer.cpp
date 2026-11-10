#include "MciPlayer.h"

#include <iostream>

namespace CocosDenshion {

void MciPlayer::Open(const std::string& path, unsigned int soundId) {
  _path = path;
  _soundId = soundId;
  std::cout << "MciPlayer::Open " << _path << "\n";
}

void MciPlayer::Play(bool loop) {
  std::cout << "MciPlayer::Play " << _path
            << " loop=" << (loop ? "true" : "false") << "\n";
}

}
