#include "Mixer.h"

#include <iostream>

namespace SDL {

MixChunk* Mix_LoadWAV(const char* filePath) {
  std::cout << "Mix_LoadWAV " << filePath << "\n";
  return new MixChunk(filePath);
}

int Mix_PlayChannel(int channel, const MixChunk* chunk, int loops) {
  std::cout << "Mix_PlayChannel path=" << chunk->path
            << " channel=" << channel << " loops=" << loops << "\n";
  return channel;
}

}
