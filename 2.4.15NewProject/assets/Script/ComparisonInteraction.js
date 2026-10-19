cc.Class({
    extends: cc.Component,

    onLoad: function () {
        this._clickCount = 0;
        this._label = this.node.parent.getChildByName('label').getComponent(cc.Label);
        this._label.string = 'Clicks: 0';
        this.node.on(cc.Node.EventType.MOUSE_DOWN, this._onSpriteMouseDown, this);
    },

    onDestroy: function () {
        this.node.off(cc.Node.EventType.MOUSE_DOWN, this._onSpriteMouseDown, this);
    },

    _onSpriteMouseDown: function (event) {
        if (event.getButton() !== 0) return;

        this._clickCount += 1;
        this._label.string = 'Clicks: ' + this._clickCount;
        this.node.x += 40;
    }
});
