var Net = require("Net");
var Global = require("Global");
cc.Class({
    extends: cc.Component,

    properties: {
        lblName:cc.Label,
        lblID:cc.Label,
        joinGameWin:cc.Node,
        createRoomWin:cc.Node,
        btnJoinGame:cc.Node,
        btnReturnGame:cc.Node,
        sprHeadImg:cc.Sprite,
        bqsmDlg:cc.Node,
        settingsDlg:cc.Node,
    },

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        if(!cc.sys.isNative && cc.sys.isMobile){
            var cvs = this.node.getComponent(cc.Canvas);
            cvs.fitHeight = true;
            cvs.fitWidth = true;
        }
        if(!cc.vv){
            cc.director.loadScene("start");
            return;
        }
        this.initLabels();

        if(cc.vv.gameNetMgr.roomId == null){
            this.btnJoinGame.active = true;
            this.btnReturnGame.active = false;
        }else{
            this.btnJoinGame.active = false;
            this.btnReturnGame.active = true;
        }



        var imgLoader = this.sprHeadImg.node.getComponent("ImageLoader");
        imgLoader.setUserID(cc.vv.userMgr.userId);

        cc.vv.audioMgr.pauseAll();
        cc.vv.audioMgr.playBGM("bgMain.mp3");

        cc.vv.utils.addEscEvent(this.node);
    },

    start(){
        //判断是否有旧房间，如果有的话返回旧房间
        var roomId = cc.vv.userMgr.oldRoomId;
        if(roomId != null){
            cc.vv.userMgr.oldRoomId = null;
            cc.vv.userMgr.enterRoom(roomId);
        }
    },

    initLabels:function(){
        this.lblName.string = cc.vv.userMgr.userName;
        this.lblID.string = "ID:" + cc.vv.userMgr.userId;
    },

    onCreateRoomClicked:function(){
        if(cc.vv.gameNetMgr.roomId != null){
            cc.vv.alert.show("提示","房间已经创建!\n必须解散当前房间才能创建新的房间");
            return;
        }
        console.log("onCreateRoomClicked");
        this.createRoomWin.active = true;   
    },

    onReturnGameClicked:function(){
        // cc.vv.wc.show("正在加载资源");
        // cc.loader.loadRes("sounds/bgFight",function(completedCount,totalCount,item){
        // },function(err,assets){
        //     cc.vv.wc.show('正在返回游戏房间');
        //     cc.director.loadScene("pkgame");  
        // }); 
        cc.vv.wc.show('正在返回游戏房间');
        cc.director.loadScene("pkgame");
    },

    onJoinGameClicked:function(){
        this.joinGameWin.active = true;
    },

    onBtnBanquanClicked:function(event){
        this.bqsmDlg.active = true;
    },

    onDlgBqsmClicked:function(event){
        this.bqsmDlg.active = false;
    },

    onBtnSettingsClicked:function(event){
        this.settingsDlg.active = true;
    },

    // update (dt) {},
});
