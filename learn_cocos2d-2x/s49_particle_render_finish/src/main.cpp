#include "cocos2dx/particle_nodes/CCParticleSystemQuad.h"

#include <iomanip>
#include <iostream>

int main() {
    auto system = cocos2d::CCParticleSystemQuad::create("effects/spark.plist");
    if (!system) return 1;

    std::cout << std::fixed << std::setprecision(1)
              << "更新粒子四边形 -> 上传活动 quad -> glDrawElements" << std::endl;
    for (int frame = 1; frame <= 7 && !system->removedOnFinish(); ++frame) {
        if (frame == 3) system->stopSystem();
        system->update(0.3f);
        const unsigned drawIndices = system->draw();
        std::cout << "t=" << frame * 0.3f << "s active=" << system->activeParticles()
                  << " uploadedQuads=" << system->uploadedQuadCount()
                  << " drawIndices=" << drawIndices
                  << " finished=" << system->finished() << std::endl;
    }
}
