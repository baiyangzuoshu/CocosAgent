#include "CCRenderer.h"
#include <algorithm>
#include <iostream>

namespace cocos2d {
void Renderer::addCommand(const std::string& owner, float globalOrder) {
    std::cout << "visit " << owner << " (globalZ=" << globalOrder << ")\n";
    _commands.push_back({ owner, globalOrder, {} });
}

void Renderer::addCommand(const std::string& owner, float globalOrder, const TrianglesCommand& triangles) {
    std::cout << "visit " << owner << " (globalZ=" << globalOrder << ")\n";
    _commands.push_back({ owner, globalOrder, triangles });
}

void Renderer::render() {
    std::stable_sort(_commands.begin(), _commands.end(), [](const Command& left, const Command& right) {
        return left.globalOrder < right.globalOrder;
    });
    std::cout << "Renderer::render submits " << _commands.size() << " command(s)\n";
    std::size_t vertices = 0;
    std::size_t indices = 0;
    for (const Command& command : _commands) {
        std::cout << "submit " << command.owner << " (globalZ=" << command.globalOrder << ")";
        const auto& data = command.triangles.getTriangles();
        if (!data.indices.empty()) {
            const Texture2D* texture = command.triangles.getTexture();
            std::cout << " texture=" << (texture ? texture->path() : "none")
                      << " triangles=" << data.indices.size() / 3
                      << " firstUV=(" << data.vertices[0].u << "," << data.vertices[0].v << ")";
            vertices += data.vertices.size();
            indices += data.indices.size();
        }
        std::cout << "\n";
    }
    if (indices) std::cout << "drawBatchedTriangles: " << vertices << " vertices, " << indices << " indices\n";
    clear();
}
} // namespace cocos2d
