#pragma once

class CommandBuffer;

class Device {
public:
    virtual ~Device() = default;
    virtual CommandBuffer* newCommandBuffer() = 0;
};
