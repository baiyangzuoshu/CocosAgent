/*
 * Creator 2.4.15 WebGL 运行时源码摘录。
 * 全链路步骤号与本课 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 9 步 | engine/2.4.15engine/cocos2d/core/renderer/webgl/assemblers/sprite/index.js:18-60 */
let ctor = {
    getConstructor(sprite) {
        let is3DNode = sprite.node.is3DNode;

        let ctor = is3DNode ? Simple3D : Simple;
        switch (sprite.type) {
            case Type.SLICED:
                ctor = is3DNode ? Sliced3D : Sliced;
                break;
            case Type.TILED:
                ctor = is3DNode ? Tiled3D : Tiled;
                break;
            case Type.FILLED:
                if (sprite._fillType === FillType.RADIAL) {
                    ctor = is3DNode ? RadialFilled3D : RadialFilled;
                } else {
                    ctor = is3DNode ? BarFilled3D : BarFilled;
                }
                break;
            case Type.MESH:
                ctor = is3DNode ? Mesh3D : Mesh;
                break;
        }

        return ctor;
    },

    Simple,
    Sliced,
    Tiled,
    RadialFilled,
    BarFilled,
    Mesh,

    Simple3D,
    Sliced3D,
    Tiled3D,
    RadialFilled3D,
    BarFilled3D,
    Mesh3D,
};

Assembler.register(cc.Sprite, ctor);

/* 第 9 步 | engine/2.4.15engine/cocos2d/core/renderer/webgl/assemblers/sprite/2d/simple.js:28-85 */
export default class SimpleSpriteAssembler extends Assembler2D {
    updateRenderData (sprite) {
        this.packToDynamicAtlas(sprite, sprite._spriteFrame);

        if (sprite._vertsDirty) {
            this.updateUVs(sprite);
            this.updateVerts(sprite);
            sprite._vertsDirty = false;
        }
    }

    updateUVs (sprite) {
        let uv = sprite._spriteFrame.uv;
        let uvOffset = this.uvOffset;
        let floatsPerVert = this.floatsPerVert;
        let verts = this._renderData.vDatas[0];
        for (let i = 0; i < 4; i++) {
            let srcOffset = i * 2;
            let dstOffset = floatsPerVert * i + uvOffset;
            verts[dstOffset] = uv[srcOffset];
            verts[dstOffset + 1] = uv[srcOffset + 1];
        }
    }

    updateVerts (sprite) {
        let node = sprite.node,
            cw = node.width, ch = node.height,
            appx = node.anchorX * cw, appy = node.anchorY * ch,
            l, b, r, t;
        if (sprite.trim) {
            l = -appx;
            b = -appy;
            r = cw - appx;
            t = ch - appy;
        }
        else {
            let frame = sprite.spriteFrame,
                ow = frame._originalSize.width, oh = frame._originalSize.height,
                rw = frame._rect.width, rh = frame._rect.height,
                offset = frame._offset,
                scaleX = cw / ow, scaleY = ch / oh;
            let trimLeft = offset.x + (ow - rw) / 2;
            let trimRight = offset.x - (ow - rw) / 2;
            let trimBottom = offset.y + (oh - rh) / 2;
            let trimTop = offset.y - (oh - rh) / 2;
            l = trimLeft * scaleX - appx;
            b = trimBottom * scaleY - appy;
            r = cw + trimRight * scaleX - appx;
            t = ch + trimTop * scaleY - appy;
        }

        let local = this._local;
        local[0] = l;
        local[1] = b;
        local[2] = r;
        local[3] = t;
        this.updateWorldVerts(sprite);
    }

