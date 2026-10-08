var CocosAgentContentSwapCore = require('CocosAgentContentSwapCore');
var CocosAgentContentRuntime = require('CocosAgentContentRuntime');
var CocosAgentContentRuntimeClient = require('CocosAgentRuntimeChannel');

cc.Class({
    extends: cc.Component,

    properties: {
        label: {
            default: null,
            type: cc.Label
        },
        // defaults, set visually when attaching this script to the Canvas
        text: 'Hello, World!'
    },

    // use this for initialization
    onLoad: function () {
        this.label.string = this.text;
        if (CocosAgentContentRuntimeClient.session(cc)) {
            this._cocosAgentRuntime = CocosAgentContentRuntime.mount({ cc: cc, core: CocosAgentContentSwapCore });
            this._cocosAgentChannel = CocosAgentContentRuntimeClient.connect({
                cc: cc,
                runtime: this._cocosAgentRuntime,
                creatorVersion: '2.4.15',
                scene: cc.director.getScene().name,
                onError: function (error) { cc.warn('CocosAgent runtime channel:', error); }
            });
        }
    },

    onDestroy: function () {
        if (this._cocosAgentChannel) this._cocosAgentChannel.close();
        if (this._cocosAgentRuntime) this._cocosAgentRuntime.dispose();
    },

    // called every frame
    update: function (dt) {

    },
});
