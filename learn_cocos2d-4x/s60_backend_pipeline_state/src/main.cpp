#include "cocos/renderer/CCMaterial.h"
#include "cocos/renderer/CCPass.h"
#include "cocos/renderer/CCTechnique.h"

int main() {
    Material material;
    Technique technique("sprite");
    Pass pass("forward");

    material.setTechnique(&technique);
    technique.addPass(&pass);

    material.state().hasBlend = true;
    material.state().blendEnabled = true;
    material.state().hasBlendFunc = true;
    material.state().blendSrc = "ONE";
    material.state().blendDst = "ONE_MINUS_SRC_ALPHA";

    technique.state().hasBlendFunc = true;
    technique.state().blendSrc = "SRC_ALPHA";
    technique.state().blendDst = "ONE_MINUS_SRC_ALPHA";

    pass.state().hasDepthTest = true;
    pass.state().depthTest = true;

    material.preparePasses();
}
