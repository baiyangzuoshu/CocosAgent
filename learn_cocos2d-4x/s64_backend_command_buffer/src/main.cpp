#include "cocos/renderer/CCRenderer.h"
#include "cocos/renderer/backend/Device.h"

Device* createDeviceGL();

int main() {
    Device* device = createDeviceGL();
    CommandBuffer* commandBuffer = device->newCommandBuffer();
    MeshCommand body("body-program", "body-vb", "body-ib", 36);

    Renderer renderer(commandBuffer);
    renderer.render(&body);

    delete commandBuffer;
    delete device;
}
