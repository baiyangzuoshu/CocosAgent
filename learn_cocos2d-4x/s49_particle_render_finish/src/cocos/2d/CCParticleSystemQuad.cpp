#include "CCParticleSystemQuad.h"

namespace cocos2d {

std::unique_ptr<ParticleSystemQuad> ParticleSystemQuad::create(const std::string& filename) {
    std::unique_ptr<ParticleSystemQuad> system(new ParticleSystemQuad());
    if (!system->initWithFile(filename)) return nullptr;
    return system;
}

bool ParticleSystemQuad::initWithTotalParticles(int numberOfParticles) {
    if (!ParticleSystem::initWithTotalParticles(numberOfParticles)) return false;
    if (!allocMemory()) return false;
    initIndices();
    return true;
}

bool ParticleSystemQuad::allocMemory() {
    _quads.assign(_totalParticles, Quad{});
    _indices.resize(_totalParticles * 6);
    return true;
}

void ParticleSystemQuad::setTexture(const std::shared_ptr<Texture2D>& texture) {
    setTextureWithRect(texture, Rect{});
}

void ParticleSystemQuad::setTextureWithRect(const std::shared_ptr<Texture2D>& texture, const Rect& rect) {
    if (!_texture || texture->backendTexture != _texture->backendTexture) ParticleSystem::setTexture(texture);
    _textureRect = rect;
}

void ParticleSystemQuad::initIndices() {
    for (int i = 0; i < _totalParticles; ++i) {
        const int vertex = i * 4;
        const int index = i * 6;
        _indices[index + 0] = static_cast<std::uint16_t>(vertex + 0);
        _indices[index + 1] = static_cast<std::uint16_t>(vertex + 1);
        _indices[index + 2] = static_cast<std::uint16_t>(vertex + 2);
        _indices[index + 3] = static_cast<std::uint16_t>(vertex + 3);
        _indices[index + 4] = static_cast<std::uint16_t>(vertex + 2);
        _indices[index + 5] = static_cast<std::uint16_t>(vertex + 1);
    }
}

void ParticleSystemQuad::updateParticleQuads() {
    _quadParticleCount = _particleCount;
    for (int i = 0; i < _particleCount; ++i) {
        auto& vertices = _quads[i].vertices;
        const float x = _particleData.posx[i];
        const float y = _particleData.posy[i];
        vertices = {
            x - 0.5f, y - 0.5f, x + 0.5f, y - 0.5f,
            x - 0.5f, y + 0.5f, x + 0.5f, y + 0.5f,
        };
    }
}

void ParticleSystemQuad::draw(ParticleRenderer& renderer) const {
    if (_particleCount > 0) renderer.addQuadCommand(_particleCount * 6);
}

} // namespace cocos2d
