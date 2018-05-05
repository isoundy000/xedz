
cc.Class({
    extends: cc.Component,

    properties: {
        _dlg:null,
        _title:null,
        _isShow:false,
        _cards:null,
        _btnOK:null,
    },

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        var gameChild = this.node.getChildByName("game");
        this._dlg = gameChild.getChildByName("showPaisDlg");
        this._title = this._dlg.getChildByName("title").getComponent(cc.Label);
        this._cards = this._dlg.getChildByName("cards");
        this._btnOK = this._dlg.getChildByName("btnOK");

        cc.vv.utils.addClickEvent(this._btnOK,this.node,"ShowPaisDlg","onBtnOKClicked");


        var self = this;
        this.node.on('game_koudipai_finished',function(data){
            console.log('game_koudipai_finished');
            data = data.detail;
            self._dlg.active = true;
            self.showKoupais(data);
            self._title.string = "庄家扣牌";
            self._btnOK.active = true;
            self._btnOK.getComponent(cc.Button).interactable = true;
        });

        //翻底牌定主
        this.node.on('game_fandipai_dingzhu',function(data){
            console.log('game_fandipai_dingzhu');
            self.showFandipai();         
        });

        //翻底牌定主完成
        this.node.on('fandipai_dingzhu_finished',function(data){
            console.log('fandipai_dingzhu_finished');
            data = data.detail;
            self.fandipaiFinished(data);
        });

    },

    start () {
        //初始化扑克牌显示区域
        this.initDlg();
    },

    initDlg:function(){
        if(cc.vv == null){
            return;
        }

        this._dlg.active = false;

        for(var i=0;i<this._cards.children.length;++i){
            var card = this._cards.children[i].getComponent("Card");
            card.node.active = false;
            card.node.getComponent(cc.Button).interactable = false;
        }

        this._title.string = "";
        this._btnOK.active = false;
        this._btnOK.getComponent(cc.Button).interactable = false;
        
        if(cc.vv.gameNetMgr.gamestate == 'fandipai'){
            //如果是翻底牌状态
            this.showFandipai();

        }


    },

    showFandipai:function(data){
        this._dlg.active = true;
        this._title.string = "反牌定主";
        this._btnOK.active = false;
        this._btnOK.getComponent(cc.Button).interactable = false;

        this.showEmptypais();   //显示翻面牌

        var seatIndex = cc.vv.gameNetMgr.getSeatIndexByID(cc.vv.userMgr.userId);
        var teamIndex = seatIndex % 2;
        if(teamIndex != cc.vv.gameNetMgr.button % 2){
            this.setCardsClickEvent();  //设置点击扑克牌事件
        }

    },

    showKoupais:function(koupais){
        if(koupais == null){
            return;
        }
        cc.vv.pokermgr.sortPK(koupais);
        for(var i=0;i<koupais.length;++i){
            var card = this._cards.children[i].getComponent("Card");
            var pkid = koupais[i];
            card.node.active = true;
            card.node.getComponent(cc.Button).interactable = false;
            card.node.pkid = pkid;
            cc.vv.pokermgr.setCardByPKID(card,pkid);
        }
    },

    showEmptypais:function(){
        for(var i=0;i<this._cards.children.length;++i){
            var card = this._cards.children[i].getComponent("Card");
            card.node.active = true;
            card.node.getComponent(cc.Button).interactable = false;
            if(card.node.pkIndex){
                delete card.node.pkIndex;
            }
            cc.vv.pokermgr.setHoldEmpty(card);
        }
    },

    setCardsClickEvent:function(){

        for(var i=0;i<this._cards.children.length;++i){
            var card = this._cards.children[i].getComponent("Card");
            card.node.active = true;
            card.node.getComponent(cc.Button).interactable = true;
            card.node.pkIndex = i;
            cc.vv.utils.addClickEvent(card.node,this.node,"ShowPaisDlg","onDipaiClicked");
        }

    },

    fandipaiFinished:function(data){
        this._dlg.active = true;
        this._title.string = "翻牌定主";
        this._btnOK.active = true;
        this._btnOK.getComponent(cc.Button).interactable = true;
        this.showEmptypais();   //显示翻面牌

        //显示主牌
        var zhupai = this._cards.children[data.pkIndex].getComponent("Card");
        zhupai.node.pkid = data.pkId;
        cc.vv.pokermgr.setCardByPKID(zhupai,data.pkId);

    },

    onBtnOKClicked:function(event){
        this._dlg.active = false;
    },

    onDipaiClicked:function(event){
        console.log('clicked pkindex is: '+event.target.pkIndex);
        cc.vv.net.send('fandipai_dingzhu',{pkIndex:event.target.pkIndex});
    }

    // update (dt) {},
});
