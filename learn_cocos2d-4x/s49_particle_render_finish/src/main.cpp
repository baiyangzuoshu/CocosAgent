#include "cocos/2d/CCParticleSystemQuad.h"

#include <iomanip>
#include <iostream>

int main() {
    auto system = cocos2d::ParticleSystemQuad::create("particles/spark.plist");
    if (!system) return 1;

    std::cout << std::fixed << std::setprecision(1)
              << "ParticleData -> quad 缓存 -> Renderer::addCommand" << std::endl;
    for (int frame = 1; frame <= 7 && !system->removedOnFinish(); ++frame) {
        if (frame == 3) system->stopSystem();
        system->update(0.3f);
        cocos2d::ParticleRenderer renderer;
        system->draw(renderer);
        std::cout << "t=" << frame * 0.3f << "s active=" << system->activeParticles()
                  << " quadVertices=" << system->quadParticleCount() * 4
                  << " queuedIndices=" << renderer.submittedIndices
                  << " finished=" << system->finished() << std::endl;
    }
}
