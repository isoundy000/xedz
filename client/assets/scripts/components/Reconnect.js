
cc.Class({
    extends: cc.Component,

    properties: {
        _reconnect: null,
        _lblTip: null,
        _loading_image: null,
        _lastPing: 0,
    },

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        this._reconnect = cc.find("Canvas/reconnect");
        this._loading_image = this._reconnect.getChildByName("loading_image");
        var self = this;

        var fnTestServerOn = function(){
            cc.vv.net.test(function(ret){
                if(ret){
                    cc.vv.gameNetMgr.reset();

                    var roomId = cc.vv.userMgr.oldRoomId;
                    if(roomId != null){
                        cc.vv.userMgr.oldRoomId = null;
                        cc.vv.userMgr.enterRoom(roomId,function(ret){
                            if(ret.errcode != 0){
                                cc.vv.gameNetMgr.roomId = null;
                                cc.director.loadScene('hall');
                            }
                        });
                    }
                }else{
                    setTimeout(fnTestServerOn,3000);
                }
            })
        };

        var fn = function(data){
            console.log('reconnect disconnect');
            self.node.off('disconnect',fn);
            self._reconnect.active = true;
            fnTestServerOn();
        };

        this.node.on('login_finished',function(){
            self._reconnect.active = false;
            self.node.on('disconnect',fn);
        })
    },

    start () {

    },

    update (dt) {
        if(this._reconnect.active){
            this._loading_image.rotation = this._loading_image.rotation - dt*45;
        }
    },
});
