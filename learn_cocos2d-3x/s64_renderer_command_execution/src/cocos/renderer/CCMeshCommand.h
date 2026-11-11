#pragma once

#include "CCRenderCommand.h"

class MeshCommand final : public RenderCommand {
public:
    MeshCommand(int order, bool skipBatching, int materialId, unsigned int indexCount);
    bool isSkipBatching() const { return _skipBatching; }
    int getMaterialID() const { return _materialId; }
    void execute() override;
    void batchDraw();

private:
    bool _skipBatching;
    int _materialId;
    unsigned int _indexCount;
};
