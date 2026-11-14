#pragma once
struct Vertex { float x,y,u,v,r,g,b,a; };
struct ClipPosition { float x,y,z,w; };
inline ClipPosition transformPosition(const Vertex& v,const std::array<float,16>& m) {
 return {m[0]*v.x+m[4]*v.y+m[12],m[1]*v.x+m[5]*v.y+m[13],m[2]*v.x+m[6]*v.y+m[14],m[3]*v.x+m[7]*v.y+m[15]};
}
class VertexInput {
public: static void bindAttributes() { std::cout<<"CCGLProgram::addAttribute: a_position=0, a_texCoord=1, a_color=2\n"; }
 static void trace(const Vertex& v,const ClipPosition& p) { std::cout<<"CCSprite vertex position ("<<v.x<<","<<v.y<<") -> clip ("<<p.x<<","<<p.y<<","<<p.z<<","<<p.w<<")\n"; std::cout<<"uv/color stay attached to the vertex and are interpolated later\n"; }
};
