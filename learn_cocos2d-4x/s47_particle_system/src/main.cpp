#include "cocos/2d/CCParticleSystemQuad.h"

#include <iostream>

int main() {
    auto system = cocos2d::ParticleSystemQuad::create("particles/spark.plist");
    if (!system) return 1;

    std::cout << "ParticleSystemQuad\n"
              << "ParticleData slots=" << system->allocatedParticles() << '/' << system->totalParticles()
              << ", active=" << system->activeParticles() << '\n'
              << "quad slots=" << system->quadSlots() << ", index slots=" << system->indexSlots() << '\n'
              << "texture=" << system->texture()->name << ", life=" << system->life()
              << "s, emitter mode=" << system->emitterMode() << '\n';
}
