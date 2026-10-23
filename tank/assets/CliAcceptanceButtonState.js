cc.Class({
    name: 'CliAcceptanceButtonState',
    extends: cc.Component,

    properties: {
        clickCount: { default: 0, type: cc.Integer },
        lastValue: { default: 'idle', type: cc.String },
    },

    onClick: function (event, customEventData) {
        this.clickCount += 1;
        this.lastValue = customEventData || 'clicked';
    },

    onUiEvent: function () {
        const args = Array.prototype.slice.call(arguments);
        this.clickCount += 1;
        this.lastValue = args.length ? args[args.length - 1] : 'clicked';
    },
});
