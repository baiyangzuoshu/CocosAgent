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

void Mix_Pause(int channel) {
  std::cout << "Mix_Pause channel=" << channel << "\n";
}

void Mix_Resume(int channel) {
  std::cout << "Mix_Resume channel=" << channel << "\n";
}

int Mix_HaltChannel(int channel) {
  std::cout << "Mix_HaltChannel channel=" << channel << "\n";
  return 0;
}

}
