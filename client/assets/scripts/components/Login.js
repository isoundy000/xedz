
cc.Class({
    extends: cc.Component,

    properties: {
       _mima:null,
       _mimaIndex:0,
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
        }

        cc.vv.http.url = cc.vv.http.master_url; //账号服务器
        cc.vv.net.addHandler('push_need_create_role',function(){
            console.log("onLoad:push_need_create_role");
            cc.director.loadScene("createrole");
        });

        this._mima = ["A","A","B","B","A","B","A","B","A","A","A","B","B","B"];

        if(!cc.sys.isNative || cc.sys.os == cc.sys.OS_WINDOWS){
            cc.find("Canvas/btn_yk").active = true;
            cc.find("Canvas/btn_weixin").active = false;
        }
        else{
            cc.find("Canvas/btn_yk").active = true;
            cc.find("Canvas/btn_weixin").active = false;
        }

        cc.vv.utils.addEscEvent(this.node);
    },

    start(){
        // cc.vv.wc.show("正在加载资源");
        // cc.loader.loadRes("sounds/bgMain",function(completedCount,totalCount,item){
        // },function(err,assets){
        //     cc.vv.wc.hide();
        //     cc.vv.audioMgr.pauseAll();
        //     cc.vv.audioMgr.playBGM("bgMain.mp3");
        // });
        cc.vv.audioMgr.pauseAll();
        cc.vv.audioMgr.playBGM("bgMain.mp3");        
    },

    onBtnQuickStartClicked:function(){
        cc.vv.userMgr.guestAuth();
    },
    
    

    // update (dt) {},
});
