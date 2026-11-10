#include "cocos2dx/particle_nodes/CCParticleSystemQuad.h"

#include <iomanip>
#include <iostream>

int main() {
    auto system = cocos2d::CCParticleSystemQuad::particleWithFile("spark.plist");
    if (!system) return 1;

    std::cout << std::fixed << std::setprecision(1)
              << "固定数组 + 活动前缀" << std::endl
              << "配置: capacity=" << system->totalParticles()
              << ", life=" << system->life() << "s, rate=" << system->emissionRate() << "/s" << std::endl;
    for (int frame = 1; frame <= 6; ++frame) {
        system->update(0.3f);
        std::cout << "t=" << frame * 0.3f << "s active=" << system->activeParticles();
        for (unsigned i = 0; i < system->activeParticles(); ++i) {
            const auto& particle = system->particleAt(i);
            std::cout << " | x=" << particle.x << " y=" << particle.y << " ttl=" << particle.timeToLive;
        }
        std::cout << std::endl;
    }
}
