#pragma once
namespace backend {
class ProgramState { public: void apply(){std::cout<<"ProgramState bind Uniforms and textures\n";} };
class CommandBuffer { public: void drawElements(ProgramState& state){state.apply();std::cout<<"CommandBuffer drawElements -> selected backend\n";} };
class ShaderModuleGL { public: void compile(){std::cout<<"ShaderModuleGL compiles GLSL for OpenGL\n";} };
}
class Material { public: backend::ProgramState state; };
class Sprite { public: void draw(Material& material,backend::CommandBuffer& buffer){std::cout<<"Sprite submits MeshCommand with Material ProgramState\n";buffer.drawElements(material.state);} };
