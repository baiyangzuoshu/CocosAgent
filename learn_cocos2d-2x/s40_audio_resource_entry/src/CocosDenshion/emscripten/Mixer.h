#pragma once

#include <string>
#include <utility>

namespace SDL {

struct MixChunk {
  explicit MixChunk(std::string source) : path(std::move(source)) {}
  std::string path;
};

MixChunk* Mix_LoadWAV(const char* filePath);
int Mix_PlayChannel(int channel, const MixChunk* chunk, int loops);

}
