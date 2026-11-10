#include "cocos2dx/particle_nodes/CCParticleSystemQuad.h"

#include <iostream>

int main() {
    auto system = cocos2d::CCParticleSystemQuad::particleWithFile("spark.plist");
    if (!system) return 1;

    std::cout << "CCParticleSystemQuad\n"
              << "particle slots=" << system->particleDataSlots() << '/' << system->totalParticles() << '\n'
              << "quad slots=" << system->quadSlots() << ", index slots=" << system->indexSlots() << '\n'
              << "texture=" << system->texture()->path << ", life=" << system->life()
              << "s, emitter mode=" << system->emitterMode() << '\n';
}
