#include "CCMeshCommand.h"

#include <iostream>

namespace {
void glBindBuffer(const char* target, int handle) {
    std::cout << "glBindBuffer(" << target << ", " << handle << ")\n";
}
void glDrawElements(unsigned int count) {
    std::cout << "glDrawElements(TRIANGLES, " << count << ")\n";
}
}

MeshCommand::MeshCommand(int order, bool skipBatching, int materialId, unsigned int indexCount)
    : RenderCommand(order), _skipBatching(skipBatching), _materialId(materialId), _indexCount(indexCount) {}

void MeshCommand::execute() {
    std::cout << "MeshCommand::execute -> apply GLProgramState and RenderState\n";
    glBindBuffer("ARRAY_BUFFER", 1);
    glBindBuffer("ELEMENT_ARRAY_BUFFER", 2);
    glDrawElements(_indexCount);
    glBindBuffer("ELEMENT_ARRAY_BUFFER", 0);
    glBindBuffer("ARRAY_BUFFER", 0);
}

void MeshCommand::batchDraw() {
    std::cout << "MeshCommand::batchDraw materialID=" << _materialId << "\n";
    glDrawElements(_indexCount);
}
