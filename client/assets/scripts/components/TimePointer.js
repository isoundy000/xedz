
cc.Class({
    extends: cc.Component,

    properties: {

        _arrow:null,
        _pointer:null,
        _timeLabel:null,
        _time:-1,
        _alertTime:-1,
        _reStart:false,
        
    },

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        var gameChild = this.node.getChildByName("game");
        this._arrow = gameChild.getChildByName("arrow");
        this._pointer = this._arrow.getChildByName("pointer");
        this.initPointer();

        this._timeLabel = this._arrow.getChildByName("lblTime").getComponent(cc.Label);
        this._timeLabel.string = "00";

        var self = this;

        this.node.on('game_begin',function(data){
            self.initPointer();
        });

        this.node.on('game_qipai_wait',function(data){
            self.initPointer();
            self._time = 1;
            self._alertTime = 1;
        });

        this.node.on('qipai_finished',function(data){
            self.initPointer();
        });

        this.node.on('game_dingzhu',function(data){
            self.initPointer();
            self._time = 5;
            self._alertTime = 3;
        });

        this.node.on('game_koudipai_notified',function(data){
            self.initPointer();
            self._time = 10;
            self._alertTime = 3;
        });

        this.node.on('game_chupai',function(data){
            self.initPointer();
            self._time = 10;
            self._alertTime = 3;

        });
    },


    initPointer:function(){
        if(cc.vv == null){
            return;
        }
        var gamestate = cc.vv.gameNetMgr.gamestate;

        this._arrow.active = gamestate == "qipai" 
            || gamestate == "dingzhu" || gamestate == "koudipai"
            || gamestate == "chupai";
        
        if(!this._arrow.active){
            return;
        }
        this._reStart = true;
        var turn = cc.vv.gameNetMgr.turn;
        var localIndex = cc.vv.gameNetMgr.getLocalIndex(turn);
        for(var i = 0; i < this._pointer.children.length; ++i){
            this._pointer.children[i].active = i == localIndex;
        }
    },
    start () {

        if(cc.vv.gameNetMgr.gamestate == 'qipai'){
            this.initPointer();
            this._time = 1;
            this._alertTime = 1;
        }else if(cc.vv.gameNetMgr.gamestate == 'dingzhu'){
            this.initPointer();
            this._time = 5;
            this._alertTime = 3;
        }else if(cc.vv.gameNetMgr.gamestate == 'koudipai'){
            this.initPointer();
            this._time = 10;
            this._alertTime = 3;
        }

    },

    update (dt) {
        if(this._time > 0){
            this._time -= dt;
            if(this.alertTime > 0 && this._time < this._alertTime){
                cc.vv.audioMgr.playSFX("timeup_alram.mp3");
                this._alertTime = -1;
            }
            var pre = "";
            if(this._time < 0){
                this._time = 0;
            }

            var t = Math.ceil(this._time);
            if(t < 10){
                pre = "0";
            }
            this._timeLabel.string = pre + t;

            if(this._reStart && this._time == 0){
                this._reStart = false;
                var state = cc.vv.gameNetMgr.gamestate;
                if(state == 'qipai'){
                    if(cc.vv.gameNetMgr.turn == cc.vv.gameNetMgr.seatIndex){
                        cc.vv.net.send("qipai_guo");
                    }
                }
            }
        }
    },
});
