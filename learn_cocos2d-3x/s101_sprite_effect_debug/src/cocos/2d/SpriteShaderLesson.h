#pragma once
class GLProgramState { public: void apply(){std::cout<<"GLProgramState::apply program + UniformValue\n";} };
class TrianglesCommand { public: explicit TrianglesCommand(GLProgramState& s):state(s){} GLProgramState& state; void execute(){state.apply();std::cout<<"TrianglesCommand -> glDrawElements\n";} };
class Renderer { public: void addCommand(TrianglesCommand& c){_queue.push_back(&c);std::cout<<"Renderer enqueue TrianglesCommand\n";} void render(){for(auto c:_queue)c->execute();} private:std::vector<TrianglesCommand*> _queue;};
class Sprite { public: void draw(Renderer& r,TrianglesCommand& c){std::cout<<"Sprite creates triangle command from quad\n";r.addCommand(c);} };
