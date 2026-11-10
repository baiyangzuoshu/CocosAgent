#include "cocos/audio/include/AudioEngine.h"
#include "cocos/audio/AudioEngineImpl.h"

#include <unordered_map>
#include <utility>

namespace cocos2d {
namespace experimental {

static AudioEngineImpl s_audioEngineImpl;
static std::unordered_map<int, AudioEngine::AudioState> s_states;
static std::unordered_map<int, std::string> s_paths;

int AudioEngine::play2d(const std::string& filePath, bool loop, float volume) {
  if (filePath.empty()) return -1;
  const int audioId = s_audioEngineImpl.play2d(filePath, loop, volume);
  s_states[audioId] = AudioState::PLAYING;
  s_paths[audioId] = filePath;
  return audioId;
}

void AudioEngine::pause(int audioId) {
  const auto found = s_states.find(audioId);
  if (found == s_states.end() || found->second != AudioState::PLAYING) return;
  s_audioEngineImpl.pause(audioId);
  found->second = AudioState::PAUSED;
}

void AudioEngine::resume(int audioId) {
  const auto found = s_states.find(audioId);
  if (found == s_states.end() || found->second != AudioState::PAUSED) return;
  s_audioEngineImpl.resume(audioId);
  found->second = AudioState::PLAYING;
}

void AudioEngine::stop(int audioId) {
  const auto found = s_states.find(audioId);
  if (found == s_states.end()) return;
  s_audioEngineImpl.stop(audioId);
  s_states.erase(found);
  s_paths.erase(audioId);
}

AudioEngine::AudioState AudioEngine::getState(int audioId) {
  const auto found = s_states.find(audioId);
  return found == s_states.end() ? AudioState::ERROR : found->second;
}

void AudioEngine::setFinishCallback(int audioId, FinishCallback callback) {
  if (s_states.count(audioId)) {
    s_audioEngineImpl.setFinishCallback(audioId, std::move(callback));
  }
}

void AudioEngine::notifyFinishedForDemo(int audioId) {
  const auto found = s_paths.find(audioId);
  if (found == s_paths.end()) return;
  s_audioEngineImpl.signalFinished(audioId, found->second);
  s_states.erase(audioId);
  s_paths.erase(found);
}

}
}
