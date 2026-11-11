#include "Device.h"
#include "opengl/CommandBufferGL.h"

#include <iostream>

class DeviceGL final : public Device {
public:
    CommandBuffer* newCommandBuffer() override {
        std::cout << "DeviceGL.newCommandBuffer\n";
        return new CommandBufferGL();
    }
};

Device* createDeviceGL() {
    return new DeviceGL();
}
