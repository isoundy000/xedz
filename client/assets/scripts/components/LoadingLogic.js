
// Compatible with v1.5.0+
if(!cc.loader.loadResAll){
    cc.loader.loadResAll = cc.loader.loadResDir;
}
cc.Class({
    extends: cc.Component,

    properties: {
        tipLabel:cc.Label,
        _stateStr:'',
        _progress:0.0,
        _splash:null,
        _isLoading:false,
    },
    // LIFE-CYCLE CALLBACKS:

    // use this for initialization
    onLoad () {
        if(!cc.sys.isNative && cc.sys.isMobile){
            var cvs = this.node.getComponent(cc.Canvas);
            cvs.fitHeight = true;
            cvs.fitWidth = true;
        }
        this.tipLabel.string = this._stateStr;
        this.startPreloading();
    },

    startPreloading:function(){
        this._stateStr="正在加载资源，请稍候";
        this._isLoading=true;
        var self=this;
        var onProgress=function(completedCount,totalCount,item){
            if(self._isLoading){
                self._progress = Number.parseFloat((completedCount/totalCount).toFixed(2));
            }
        };

        cc.loader.loadResAll("textures",onProgress,function(err,assets){
            self.onLoadComplete();
        });
    },

    onLoadComplete:function(){
        this._isLoading=false;
        this._stateStr="准备登陆";
        cc.director.loadScene("login");
        cc.loader.onComplete=null;
        this._progress = 100.0;
    },
    update (dt) {
        if(this._stateStr.length==0){
            return;
        }
        this.tipLabel.string=this._stateStr+' ';
        if(this._isLoading){
            this.tipLabel.string+=Math.floor(this._progress*100)+"%";
        }else{
            var t=Math.floor(Date.now()/1000)%4;
            for(var i=0;i<t;i++){
                this.tipLabel.string+='.';
            }
        }
    },
});
