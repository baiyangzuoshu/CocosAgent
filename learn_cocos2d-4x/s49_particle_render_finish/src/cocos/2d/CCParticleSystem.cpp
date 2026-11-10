#include "CCParticleSystem.h"

#include <algorithm>
#include <utility>

namespace cocos2d {

bool ParticleData::init(int count) {
    maxCount = count;
    posx.assign(count, 0.0f);
    posy.assign(count, 0.0f);
    dirX.assign(count, 0.0f);
    dirY.assign(count, 0.0f);
    timeToLive.assign(count, 0.0f);
    return true;
}

FileUtils* FileUtils::getInstance() {
    static FileUtils instance;
    return &instance;
}

std::string FileUtils::fullPathForFilename(const std::string& path) const {
    return "Resources/" + path;
}

ParticleConfig FileUtils::getValueMapFromFile(const std::string&) const {
    return {4, 1.0f, 4.0f, 4.0f, -2.0f, 0, "spark.png"};
}

TextureCache* TextureCache::getInstance() {
    static TextureCache cache;
    return &cache;
}

std::shared_ptr<Texture2D> TextureCache::addImage(const std::string& path) {
    return std::make_shared<Texture2D>(path, 1);
}

bool ParticleSystem::initWithFile(const std::string& plistFile) {
    _plistFile = FileUtils::getInstance()->fullPathForFilename(plistFile);
    const ParticleConfig dictionary = FileUtils::getInstance()->getValueMapFromFile(_plistFile);
    const auto slash = plistFile.find_last_of('/');
    const std::string dirname = slash == std::string::npos ? "" : plistFile.substr(0, slash + 1);
    return initWithDictionary(dictionary, dirname);
}

bool ParticleSystem::initWithDictionary(const ParticleConfig& dictionary, const std::string& dirname) {
    if (!initWithTotalParticles(dictionary.maxParticles)) return false;
    _life = dictionary.life;
    _emissionRate = dictionary.emissionRate;
    _speed = dictionary.speed;
    _gravityY = dictionary.gravityY;
    _emitterMode = dictionary.emitterType;
    setTexture(TextureCache::getInstance()->addImage(dirname + dictionary.textureFileName));
    return static_cast<bool>(_texture);
}

bool ParticleSystem::initWithTotalParticles(int numberOfParticles) {
    _totalParticles = numberOfParticles;
    _particleCount = 0;
    _emitCounter = 0;
    _isActive = true;
    return _particleData.init(_totalParticles);
}

void ParticleSystem::addParticles(int count) {
    count = std::min(count, _totalParticles - _particleCount);
    if (count <= 0) return;
    const int start = _particleCount;
    _particleCount += count;
    for (int i = start; i < _particleCount; ++i) {
        _particleData.posx[i] = 0.0f;
        _particleData.posy[i] = 0.0f;
        _particleData.dirX[i] = _speed;
        _particleData.dirY[i] = 0.0f;
        _particleData.timeToLive[i] = std::max(0.0f, _life);
    }
}

void ParticleSystem::update(float dt) {
    if (_isActive && _emissionRate > 0) {
        const float rate = 1.0f / _emissionRate;
        if (_particleCount < _totalParticles) _emitCounter += dt;
        const int due = static_cast<int>(_emitCounter / rate);
        const int count = std::min(due, _totalParticles - _particleCount);
        addParticles(count);
        _emitCounter -= count * rate;
        if (_particleCount == _totalParticles) _emitCounter = 0.0f;
    }

    for (int i = 0; i < _particleCount; ++i) {
        _particleData.timeToLive[i] -= dt;
    }

    int index = 0;
    while (index < _particleCount) {
        if (_particleData.timeToLive[index] > 0) {
            ++index;
        } else {
            const int last = _particleCount - 1;
            if (index != last) {
                _particleData.posx[index] = _particleData.posx[last];
                _particleData.posy[index] = _particleData.posy[last];
                _particleData.dirX[index] = _particleData.dirX[last];
                _particleData.dirY[index] = _particleData.dirY[last];
                _particleData.timeToLive[index] = _particleData.timeToLive[last];
            }
            --_particleCount;
        }
    }

    for (int i = 0; i < _particleCount; ++i) {
        _particleData.dirY[i] += _gravityY * dt;
        _particleData.posx[i] += _particleData.dirX[i] * dt;
        _particleData.posy[i] += _particleData.dirY[i] * dt;
    }
    updateParticleQuads();
    postStep();

    if (!_isActive && _particleCount == 0) {
        _finished = true;
        if (_autoRemoveOnFinish) _removedOnFinish = true;
    }
}

void ParticleSystem::stopSystem() {
    _isActive = false;
    _emitCounter = 0.0f;
}

void ParticleSystem::updateParticleQuads() {}

void ParticleSystem::postStep() {}

void ParticleSystem::setTexture(const std::shared_ptr<Texture2D>& texture) {
    _texture = texture;
}

} // namespace cocos2d
