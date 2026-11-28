/*
 * Creator 2.4.15 WebGL 运行时源码摘录。
 * 全链路步骤号与本课 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 9 步 | engine/2.4.15engine/cocos2d/core/renderer/assembler.js:28-48 */
Assembler.init = function (renderComp) {
    let renderCompCtor = renderComp.constructor;
    let assemblerCtor =  renderCompCtor.__assembler__;
    while (!assemblerCtor) {
        renderCompCtor = renderCompCtor.$super;
        if (!renderCompCtor) {
            cc.warn(`Can not find assembler for render component : [${cc.js.getClassName(renderComp)}]`);
            return;
        }
        assemblerCtor =  renderCompCtor.__assembler__;
    }
    if (assemblerCtor.getConstructor) {
        assemblerCtor = assemblerCtor.getConstructor(renderComp);
    }

    if (!renderComp._assembler || renderComp._assembler.constructor !== assemblerCtor) {
        let assembler = assemblerPool.get(assemblerCtor);
        assembler.init(renderComp);
        renderComp._assembler = assembler;
    }
};

