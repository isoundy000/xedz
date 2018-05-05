
//取出URL中所有get参数
function urlParse(){
    var params = {};
    if(window.location == null){
        return params;
    }
    var name,value; 
    var str=window.location.href; //取得整个地址栏
    var num=str.indexOf("?") 
    str=str.substr(num+1); //取得所有参数   stringvar.substr(start [, length ]

    var arr=str.split("&"); //各个参数放到数组里
    for(var i=0;i < arr.length;i++){ 
        num=arr[i].indexOf("="); 
        if(num>0){ 
            name=arr[i].substring(0,num);
            value=arr[i].substr(num+1);
            params[name]=value;
        } 
    }
    return params;
}

//初始化各种Manager对象
function initMgr(){
    cc.vv={};

    var UserMgr = require("UserMgr");
    cc.vv.userMgr = new UserMgr();  //用户登录管理

    



    cc.vv.http = require("HTTP");   //http
    cc.vv.global = require("Global");   //全局参数
    cc.vv.net = require("Net"); //websocket.io

    //gameNetMgr 游戏全局管理
    var GameNetMgr = require("GameNetMgr");
    cc.vv.gameNetMgr = new GameNetMgr();
    cc.vv.gameNetMgr.initHandlers();

    //audioMgr 音效管理
    var AudioMgr = require("AudioMgr");
    cc.vv.audioMgr = new AudioMgr();
    cc.vv.audioMgr.init();

    var Utils = require("Utils");
    cc.vv.utils = new Utils();
    
    cc.args = urlParse();   //记录下URL请求参数
}
cc.Class({
    extends: cc.Component,

    properties: {
        loadingProgess:cc.Label,
    },

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        //适配屏幕
        if(!cc.sys.isNative && cc.sys.isMobile){
            var cvs = this.node.getComponent(cc.Canvas);
            cvs.fitHeight = true;
            cvs.fitWidth = true;
        }
        //初始化Manager对象
        initMgr();
        console.log('haha');
        this._mainScene='loading';  //loading secene
        this.showSplash(function(){
            var url=cc.url.raw('resources/ver/cv.txt'); //获取版本信息
            cc.loader.load(url,function(err,data){
                cc.VERSION=data;
                console.log('current core version:'+cc.VERSION);
                this.getServerInfo();
            }.bind(this));
        }.bind(this));
    },

    //显示 Splash 3秒，
    showSplash:function(callback){
        var self=this;
        var SHOW_TIME=2000;
        var FADE_TIME=500;
        this._splash=cc.find("Canvas/splash");
        if(true || cc.sys.os!=cc.sys.OS_IOS || !cc.sys.isNative){
            this._splash.active = true;
            if(this._splash.getComponent(cc.Sprite).spriteFrame==null){
                callback();
                return;
            }
            var t=Date.now();
            var fn=function(){
                var dt=Date.now() - t;
                if(dt<SHOW_TIME){
                    setTimeout(fn,33);
                }else{
                    var op = (1 - ((dt - SHOW_TIME) / FADE_TIME)) * 255;
                    if(op < 0){
                        self._splash.opacity = 0;
                        callback();
                    }else{
                        self._splash.opacity = op;
                        setTimeout(fn,33);
                    }
                }
            };
            setTimeout(fn,33);
        }else{
            this._splash.active=false;
            callback();
        }
    },

    getServerInfo:function(){
        var self=this;
        var onGetVersion = function(ret){
            if(ret.version == null){
                console.log("error.");
            }else{
                cc.vv.SI = ret; /* 重要，此处获取并保存服务器信息 */
                if(ret.version != cc.VERSION){
                    console.log("版本过旧");
                    //cc.find("Canvas/alert").active = true;
                }else{
                    cc.director.loadScene(self._mainScene);
                }
            }
        }

        var xhr = null;
        var complete = false;
        var fnRequest = function(){
            self.loadingProgess.string = "正在连接服务器......";
            xhr = cc.vv.http.sendRequest("/get_serverinfo",null,function(ret){
                xhr=null;
                complete=true;
                onGetVersion(ret);
            });
            setTimeout(fn,5000);
        };

        var fn = function(){
            if(!complete){
                if(xhr){
                    xhr.abort();
                    self.loadingProgess.string = "连接失败，即将重试";
                    setTimeout(function(){
                        fnRequest();
                    },5000);
                }else{
                    fnRequest();
                }
            }
        };
        fn();
    },

    //下载按钮响应事件，暂时不用
    onBtnDownloadClicked:function(){
        cc.sys.openURL(cc.vv.SI.appweb);
    },


});
