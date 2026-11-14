#pragma once
struct Color4 { float r,g,b,a; };
struct UV { float u,v; };
class Texture2D {
public: Texture2D():_pixels{Color4{1,0,0,1},Color4{0,1,0,1},Color4{0,0,1,1},Color4{1,1,1,1}} {}
 Color4 sampleNearest(UV uv) const { int x=std::min(1,static_cast<int>(uv.u*2)); int y=std::min(1,static_cast<int>(uv.v*2)); return _pixels[y*2+x]; }
 static UV interpolate(UV a,UV b,UV c,float wa,float wb,float wc) { return {a.u*wa+b.u*wb+c.u*wc,a.v*wa+b.v*wb+c.v*wc}; }
 static const char* fragmentOperation() { return "texture(u_texture, v_texCoord)"; }
private: std::array<Color4,4> _pixels;
};
inline void printSample(UV uv,Color4 c) { std::cout<<"interpolated uv=("<<uv.u<<","<<uv.v<<") sampled rgba=("<<c.r<<","<<c.g<<","<<c.b<<","<<c.a<<")\n"; }
