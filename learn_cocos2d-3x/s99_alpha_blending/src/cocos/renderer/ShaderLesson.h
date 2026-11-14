#pragma once
struct Rgba { float r,g,b,a; };
inline Rgba blendStraight(Rgba src,Rgba dst) { float k=1-src.a; return {src.r*src.a+dst.r*k,src.g*src.a+dst.g*k,src.b*src.a+dst.b*k,src.a+dst.a*k}; }
inline Rgba blendPremultiplied(Rgba src,Rgba dst) { float k=1-src.a; return {src.r+dst.r*k,src.g+dst.g*k,src.b+dst.b*k,src.a+dst.a*k}; }
inline Rgba premultiply(Rgba c) { return {c.r*c.a,c.g*c.a,c.b*c.a,c.a}; }
inline void describeBlend() { std::cout<<"GLRenderState stores the Sprite BlendFunc and Renderer applies it\n"; }
