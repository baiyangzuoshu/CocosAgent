#include "cocos/2d/CCParticleSystemQuad.h"

#include <iomanip>
#include <iostream>

int main() {
    auto system = cocos2d::ParticleSystemQuad::create("particles/spark.plist");
    if (!system) return 1;

    std::cout << std::fixed << std::setprecision(1)
              << "ParticleData 分离数组" << std::endl
              << "配置: capacity=" << system->totalParticles()
              << ", life=" << system->life() << "s, rate=" << system->emissionRate() << "/s" << std::endl;
    for (int frame = 1; frame <= 6; ++frame) {
        system->update(0.3f);
        const auto& data = system->particleData();
        std::cout << "t=" << frame * 0.3f << "s active=" << system->activeParticles();
        for (int i = 0; i < system->activeParticles(); ++i) {
            std::cout << " | x=" << data.posx[i] << " y=" << data.posy[i] << " ttl=" << data.timeToLive[i];
        }
        std::cout << std::endl;
    }
}
