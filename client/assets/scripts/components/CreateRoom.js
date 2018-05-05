cc.Class({
    extends: cc.Component,

    properties: {
        _gamelist: null,
        _currentGame: null,
    },

    // use this for initialization
    onLoad: function () {

        this._gamelist = this.node.getChildByName('game_list');
    },

    onBtnBack: function () {
        this.node.active = false;
    },

    onBtnOK: function () {
        var usedTypes = ['xedz'];
        var type = this.getType();
        if (usedTypes.indexOf(type) == -1) {
            return;
        }

        this.node.active = false;
        this.createRoom();
    },

    getType: function () {
        return 'xedz';
    },

    getSelectedOfRadioGroup(groupRoot) {
        console.log(groupRoot);
        var t = this._currentGame.getChildByName(groupRoot);

        var arr = [];
        for (var i = 0; i < t.children.length; ++i) {
            var n = t.children[i].getComponent("RadioButton");
            if (n != null) {
                arr.push(n);
            }
        }
        var selected = 0;
        for (var i = 0; i < arr.length; ++i) {
            if (arr[i].checked) {
                selected = i;
                break;
            }
        }
        return selected;
    },

    createRoom: function () {
        var self = this;
        var onCreate = function (ret) {
            if (ret.errcode !== 0) {
                cc.vv.wc.hide();
                //console.log(ret.errmsg);
                if (ret.errcode == 2222) {
                    cc.vv.alert.show("提示", "钻石不足，创建房间失败!");
                }
                else {
                    cc.vv.alert.show("提示", "创建房间失败,错误码:" + ret.errcode);
                }
            }
            else {
                //创建完房间，在数据库中写入相应房间数据和用户房间数据后，连接游戏服务器。
                cc.vv.gameNetMgr.connectGameServer(ret);
            }
        };

        var type = this.getType();
        var conf = null;
        if (type == 'xedz') {
            conf = this.constructXEDZConf();
        }
        conf.type = type;
        
        var data = {
            account: cc.vv.userMgr.account,
            sign: cc.vv.userMgr.sign,
            conf: JSON.stringify(conf)
        };
        console.log(data);


        // cc.vv.wc.show("正在加载资源");
        // cc.loader.loadRes("sounds/bgFight",function(completedCount,totalCount,item){
            
        // },function(err,assets){
        //     cc.vv.wc.show("正在创建房间");
        //     cc.vv.http.sendRequest("/create_private_room", data, onCreate);
        // });
        cc.vv.wc.show("正在创建房间");
        cc.vv.http.sendRequest("/create_private_room", data, onCreate);
        
    },

    constructXEDZConf: function(){
        var jushuxuanze = this.getSelectedOfRadioGroup('xuanzejushu');

        var conf = {
            jushuxuanze : jushuxuanze,   
        };

        return conf;
    },


    // called every frame, uncomment this function to activate update callback
    update: function (dt) {

        var type = this.getType();
        if (this.lastType != type) {
            this.lastType = type;
            for (var i = 0; i < this._gamelist.childrenCount; ++i) {
                this._gamelist.children[i].active = false;
            }

            var game = this._gamelist.getChildByName(type);
            if (game) {
                game.active = true;
            }
            this._currentGame = game;
        }
    },
});