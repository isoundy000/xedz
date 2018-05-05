
cc.Class({
    extends: cc.Component,

    properties: {
        _sprIcon:null,
        _ready:null,
        _offline:null,
        _lblName:null,
        _zhuang:null,
        _dui:null,
        _chatBubble:null,
        _emoji:null,

        _userName:"",
        _isReady:false,
        _isOffline:false,
        _isZhuang:false,
        _duiIndex:0,
        _userId:null,

    },

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        if(cc.vv==null){
            return;
        }

        this._sprIcon=this.node.getChildByName("icon").getComponent("ImageLoader");
        this._lblName=this.node.getChildByName("name").getComponent(cc.Label);
        this._offline=this.node.getChildByName("offline");
        this._ready=this.node.getChildByName("ready");
        this._zhuang=this.node.getChildByName("zhuang");
        this._dui=this.node.getChildByName("dui").getComponent(cc.Sprite);

        this._chatBubble = this.node.getChildByName("ChatBubble");
        if(this._chatBubble != null){
            this._chatBubble.active = false;            
        }
        
        this._emoji = this.node.getChildByName("emoji");
        if(this._emoji != null){
            this._emoji.active = false;
        }

        this.refresh();

        if(this._sprIcon && this._userId){
            this._sprIcon.setUserID(this._userId);
        }
    },

    refresh:function(){
        if(this._lblName){
            this._lblName.string = this._userName;    
        }
        if(this._zhuang){
            this._zhuang.active=this._isZhuang;
        }
        if(this._ready){
            this._ready.active = this._isReady; 
        }
        if(this._offline){
            this._offline.active = this._isOffline && this._userName != "";
        }
        if(this._dui){
            var self=this;
            var url="textures/images/flag-";
            url+=(this._duiIndex==0?"red":"blue");

            cc.loader.loadRes(url,cc.SpriteFrame,function(err,spriteFrame){
                self._dui.spriteFrame=spriteFrame;
            });
        }
        this.node.active = this._userName != null && this._userName != ""; 
    },

    setName:function(name){
        this._userName=name;
    },
    setZhuang:function(value){
        this._isZhuang=value;
    },
    setReady:function(isReady){
        this._isReady = isReady;
    },
    setID:function(id){
        var idNode = this.node.getChildByName("id");
        if(idNode){
            var lbl = idNode.getComponent(cc.Label);
            lbl.string = "ID:" + id;            
        }
        
        this._userId = id;
        if(this._sprIcon){
            this._sprIcon.setUserID(id); 
        }
    },
    setDui:function(duiIndex){
        this._duiIndex=duiIndex;
    },
    setOffline:function(isOffline){
        this._isOffline = isOffline;
    },

    chat:function(content){
        if(this._chatBubble == null || this._emoji == null){
            return;
        }
        this._emoji.active = false;
        this._chatBubble.active = true;
        this._chatBubble.getComponent(cc.Label).string = content;
        this._chatBubble.getChildByName("New Label").getComponent(cc.Label).string = content;
        this._lastChatTime = 3;
    },

    emoji:function(emoji){
        //emoji = JSON.parse(emoji);
        if(this._emoji == null || this._emoji == null){
            return;
        }
        console.log(emoji);
        this._chatBubble.active = false;
        this._emoji.active = true;
        this._emoji.getComponent(cc.Animation).play(emoji);
        this._lastChatTime = 3;
    },

    

    start () {

    },

    // called every frame, uncomment this function to activate update callback
    update: function (dt) {
        if(this._lastChatTime > 0){
            this._lastChatTime -= dt;
            if(this._lastChatTime < 0){
                this._chatBubble.active = false;
                this._emoji.active = false;
                this._emoji.getComponent(cc.Animation).stop();
            }
        }
    },
});
