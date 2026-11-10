#include "cocos2dx/particle_nodes/CCParticleSystemQuad.h"

#include <iostream>

int main() {
    auto system = cocos2d::CCParticleSystemQuad::create("effects/spark.plist");
    if (!system) return 1;

    std::cout << "CCParticleSystemQuad\n"
              << "particle slots=" << system->allocatedParticles() << '/' << system->totalParticles() << '\n'
              << "quad slots=" << system->quadSlots() << ", index slots=" << system->indexSlots()
              << ", VBO particle slots=" << system->vboParticleSlots() << '\n'
              << "texture=" << system->texture()->path << ", life=" << system->life()
              << "s, emitter mode=" << system->emitterMode() << '\n';
}
