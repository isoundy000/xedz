
cc.Class({
    extends: cc.Component,

    properties: {

        gameRoot:{
            default:null,
            type:cc.Node
        },

        prepareRoot:{
            default:null,
            type:cc.Node   
        },

        _myPKArr:[],
        _selectedPokers:[],
        _chupaiSprites:[],
        _sanfanSprites:[],
        _wufanSprites:[],
        _paishuLabel:[],
        _teamVS:[],
        _zhu:null,
        _lunType:null,
        _qipaiOptions:null,  //自己的打牌选择区域
        _chupaiOptions:null,    //自己的出牌选择区域
        
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
        this.addComponent("PKRoom");
        this.addComponent("Reconnect");
        this.addComponent("TimePointer");
        this.addComponent("ShowPaisDlg");
        this.addComponent("PopupMgr");
        this.initView();
        this.initEventHandlers();

        cc.vv.utils.addEscEvent(this.node);
    },

    start () {
        this.gameRoot.active=false;
        this.prepareRoot.active=true;
        this.onGameBegin();
        cc.vv.audioMgr.pauseAll();
        cc.vv.audioMgr.playBGM("bgFight.mp3");
        cc.vv.utils.addEscEvent(this.node);
    },

    initView:function(){
        var gameChild = this.node.getChildByName("game");
        var myselfChild = gameChild.getChildByName("myself");   //获取自己的游戏区域

        var myholds = myselfChild.getChildByName("holds");  //获取自己的手牌
        
        for(var i = 0; i < myholds.children.length; ++i){
            var card = myholds.children[i].getComponent("Card");
            this._myPKArr.push(card);
            card.node.active=false; //初始化为false   
        }

        var sides = ["myself","right","up","left"];
        for(var i=0;i<sides.length;++i){
            var side = sides[i];
            var sideChild = gameChild.getChildByName(side);
            this._chupaiSprites.push(sideChild.getChildByName("chupai"));   //出牌区域
            this._sanfanSprites.push(sideChild.getChildByName("sanfan"));   //三反区域
            this._wufanSprites.push(sideChild.getChildByName("wufan"));     //五反区域
            this._paishuLabel.push(sideChild.getChildByName("paishu").getComponent(cc.Label));  //牌数标签
        }

        //获取红蓝两队比分区域
        var z_vs=gameChild.getChildByName("Z_vs");
        this._teamVS.push(z_vs.getChildByName("red_team")); //this._teamVS[0] 红队
        this._teamVS.push(z_vs.getChildByName("blue_team"));    //this._teamVS[1] 蓝队
    
        //获取自己的起牌选择区域
        this._qipaiOptions = gameChild.getChildByName("qipai_ops");

        //获取自己的出牌选择区域
        this._chupaiOptions = gameChild.getChildByName("chupai_ops");

        //获取主显示区域
        this._zhu = gameChild.getChildByName("zhu").getComponent(cc.Sprite);

        //获取轮次出牌类型显示区域
        this._lunType = gameChild.getChildByName("lunType").getComponent(cc.Label);
    },

    initEventHandlers:function(){
        cc.vv.gameNetMgr.dataEventHandler = this.node;
        
        //初始化事件监听器
        var self = this;
        
        //接收游戏手牌通知事件
        this.node.on('game_holds',function(data){
            self.initPokers();
        });
        
        this.node.on('game_begin',function(data){
            self.onGameBegin();
            //第一把开局，要提示
            // if(cc.vv.gameNetMgr.numOfGames == 1){
            //     self.checkIp();
            // }
        });
        
        this.node.on('check_ip',function(data){
            self.checkIp();
        });

        this.node.on('game_sync',function(data){
            self.onGameBegin();
            self.checkIp();
        });

        this.node.on('login_result', function () {
            self.gameRoot.active = false;
            self.prepareRoot.active = true;
            console.log('login_result');
        });

        this.node.on('game_qipai',function(data){
            self.initChupai();
            self.initLunType();
            data = data.detail;
            var pai = data.pai;
            var localIndex=cc.vv.gameNetMgr.getLocalIndex(data.seatIndex);
            if(localIndex == 0){
                self.initPokers();

                var btnGuo = self._qipaiOptions.getChildByName("btnGuo");
                btnGuo.active = true;
            }
        });

        this.node.on('game_qipai_wait',function(data){
            console.log(data);
            data=data.detail;
            //在起牌等待阶段判断起牌选项是否显示，如果没有则显示
            if(self._qipaiOptions.active == false){
                self._qipaiOptions.active = true;
            }
            cc.vv.audioMgr.playSFX("card_deal.mp3");
        });

        this.node.on('game_paishu_notified',function(data){
            console.log(data);
            data=data.detail;

            //cc.vv.wc.hide();
            if(data.seatIndex == cc.vv.gameNetMgr.seatIndex
                && cc.vv.gameNetMgr.gamestate == "qipai"){
                var btnGuo = self._qipaiOptions.getChildByName("btnGuo");
                btnGuo.active = false;
            }

            var localIndex=cc.vv.gameNetMgr.getLocalIndex(data.seatIndex);

            self._paishuLabel[localIndex].string=data.paishu;        
        });

        this.node.on('can_dingzhu',function(data){
            console.log(data);
            data = data.detail;
            var dingzhu = self._qipaiOptions.getChildByName("dingzhu");
            var child = dingzhu.children[3-data];
            child.opacity = 255;
            child.getComponent(cc.Button).interactable = true;

            self.initLunType();
        });

        //通知已定主
        this.node.on('game_dingzhu_notified',function(data){
            data = data.detail;
            if(data.userId == cc.vv.userMgr.userId){
                self._selectedPokers = [];
            }
            console.log('game_dingzhu_notified');
            self.initPokers();
            self.initQipaiOptions();
            self.initZhu();
        });

        //进入定主阶段
        this.node.on('game_dingzhu',function(data){
            self.initLunType();
        });

        //进入翻底牌定主阶段
        this.node.on('game_fandipai_dingzhu',function(data){
            self.initLunType();
        });

        //进入扣底牌阶段
        this.node.on('game_koudipai_notified',function(data){
            self.initLunType();

        });

        //更新两队比分信息
        this.node.on('game_zhuang_notified',function(){
            console.log('game_zhuang_notified');
            self.initTeamVS();   
        });

        //通知玩家显示反的区域
        this.node.on('game_fan_notified',function(data){
            console.log('game_fan_notified');
            data = data.detail;
            if(data.userId == cc.vv.userMgr.userId){
                self._selectedPokers = [];
            }
            self.showFans(data.localIndex,data.sanfans,data.wufans);
        });

        //进入出牌阶段，通知玩家进行出牌,出牌前
        this.node.on('game_chupai',function(data){
            //进入出牌阶段，隐藏起牌选项
            self.initQipaiOptions();
            if(cc.vv.gameNetMgr.turn == cc.vv.gameNetMgr.curLunInfo.firstTurn){
                //如果是轮次首位玩家出牌
                self.initChupai();
                
            }
            self.initLunType();
            //进入出牌阶段，初始化出牌选项
            self.initChupaiOptions();

        });

        //通知玩家显示所出的牌,出牌后
        this.node.on('game_chupai_notified',function(data){
            data = data.detail;
            self.initChupaiOptions();
            var btnChupai = self._chupaiOptions.getChildByName("btnChupai");
            btnChupai.active = false;
            btnChupai.getComponent(cc.Button).interactable = false;
            self.showChupai(data.userId,data.chupais);
            if(data.userId == cc.vv.userMgr.userId){
                self._selectedPokers = [];
            }
            //出牌的声音
            cc.vv.audioMgr.playSFX("card_deal.mp3");
        });

        //更新显示两队比分
        this.node.on('team_score',function(data){
            self.initTeamVS();
        });

        //选择出Q真杠还是Q假杠
        this.node.on('choice_qgang',function(data){
            self.showBtnQgang();
        });

        //更新轮次信息
        this.node.on('game_luninfo',function(data){
            if(cc.vv.gameNetMgr.turn == cc.vv.gameNetMgr.curLunInfo.firstTurn){
                //如果是轮次首位玩家出牌
                self.initLunType();
            }
        });

        //进入进宫阶段
        this.node.on('game_jingong',function(data){
            self.showBtnJingong();
            self.initLunType();
        });

        //进宫成功
        this.node.on('jingong_succeed',function(data){
            self._selectedPokers = [];
            self.showBtnJingong();
        });

        //通知玩家可以革命
        this.node.on('can_geming',function(data){
            var btnGeming = this._qipaiOptions.getChildByName("btnGeming");
            btnGeming.active = true;
        });

    },

    onGameBegin:function(){

        if(cc.vv.gameNetMgr.gamestate == ""){
            return;
        }

        this.gameRoot.active = true;
        this.prepareRoot.active = false;
        
        var sides = ["right","up","left"];
        var gameChild=this.node.getChildByName("game");
        for(var i=0;i<sides.length;++i){
            var sideChild=gameChild.getChildByName(sides[i]);
            var holds=sideChild.getChildByName("holds");
            var card=holds.getChildByName("card").getComponent("Card");
            cc.vv.pokermgr.setHoldEmpty(card);  //设置为翻面
        }

        this.initPokers();  //初始化玩家自己的手牌
        this.initPaishu();  //初始化牌数
        this.initTeamVS();  //初始化两队比分
        this.initQipaiOptions();   //初始化起牌选择区域
        this.initChupaiOptions();   //初始化出牌选择区域
        this.initFans(); //初始化反区域
        this.initZhu(); //初始化主的区域
        this.initLunType(); //初始化轮次出牌类型的区域
        this.initChupai();  //初始化出牌区域
        this._selectedPokers = [];

    },

    // update (dt) {},


    //初始化出牌
    initChupai:function(){
        for(var i = 0; i < this._chupaiSprites.length; ++i){
            this._chupaiSprites[i].active = false;
        }  

        var curLunInfo = cc.vv.gameNetMgr.curLunInfo;
        if(curLunInfo == null || curLunInfo.firstTurn == -1){
            return;
        }

        for(var i in curLunInfo.turnInfo){
            var turnInfo = curLunInfo.turnInfo[i];
            if(turnInfo != null){
                this.showChupai(turnInfo.userId,turnInfo.chupais);
            }
        }
      
    },

    //初始化出牌选项
    initQipaiOptions:function(){
        this._qipaiOptions.active=cc.vv.gameNetMgr.gamestate != "chupai";
        if(!this._qipaiOptions.active){
            return;
        }
        var btnFan = this._qipaiOptions.getChildByName("btnFan");
        btnFan.active=false;   //隐藏反的选项
        var btnGuo = this._qipaiOptions.getChildByName("btnGuo");
        btnGuo.active= false;    //隐藏过牌选项
        var btnKoudipai = this._qipaiOptions.getChildByName("btnKoudipai");
        btnKoudipai.active = false; //隐藏扣底牌选项
        var btnJingong = this._qipaiOptions.getChildByName("btnJingong");
        btnJingong.active = false;  //隐藏进宫选项
        var btnGeming = this._qipaiOptions.getChildByName("btnGeming");
        btnGeming.active = false;   //隐藏革命选项

        //初始化定主选项
        var dingzhu = this._qipaiOptions.getChildByName("dingzhu");
        if(cc.vv.gameNetMgr.zhu == -1){
            dingzhu.active = true;
            //获取玩家自己的座位信息
            var seat = cc.vv.gameNetMgr.getSeatByID(cc.vv.userMgr.userId);
            var canDingzhus = seat.canDingzhus;
            if(canDingzhus){    //如果有定主信息
                for(var i = 0; i<dingzhu.childrenCount;++i){
                    var child = dingzhu.children[3-i];  //0的花色为黑桃，对应suit=3，以此类推
                    child.opacity = canDingzhus[i]?255:128;    
                    child.getComponent(cc.Button).interactable = canDingzhus[i];
                }
            }else{
                for(var i = 0; i<dingzhu.childrenCount;++i){
                    var child = dingzhu.children[3-i];
                    child.opacity = 128;    //将定主花色选项置为半透明
                    child.getComponent(cc.Button).interactable = false;
                }
            }
        }else{
            dingzhu.active = false;
            for(var i = 0; i<dingzhu.childrenCount;++i){
                var child = dingzhu.children[3-i];
                child.opacity = 128;    //将定主花色选项置为半透明
                child.getComponent(cc.Button).interactable = false;
            }       
        }
        
        if(cc.vv.gameNetMgr.gamestate == "qipai"){
            if(cc.vv.gameNetMgr.turn == cc.vv.gameNetMgr.seatIndex){
                btnGuo.active = true;
            }
        }
        if(cc.vv.gameNetMgr.gamestate == "jingong"){
            this.showBtnJingong();  //显示进宫按钮
        }
        
        if(cc.vv.gameNetMgr.gamestate != "chupai"){
            var seatData = cc.vv.gameNetMgr.getSeatByID(cc.vv.userMgr.userId);
            btnGeming.active = seatData.canGeming;
        }


    },

    //初始化出牌选择区域
    initChupaiOptions:function(){
        this._chupaiOptions.active = cc.vv.gameNetMgr.gamestate == "chupai";
        if(!this._chupaiOptions.active){
            return;
        }
        var btnQzgang = this._chupaiOptions.getChildByName("btnQzgang");
        var btnQjgang = this._chupaiOptions.getChildByName("btnQjgang");
        btnQjgang.active = false;
        btnQjgang.getComponent(cc.Button).interactable = false;
        btnQzgang.active = false;
        btnQzgang.getComponent(cc.Button).interactable = false;

        var btnChupai = this._chupaiOptions.getChildByName("btnChupai");
        var isMyTurn = cc.vv.gameNetMgr.turn == cc.vv.gameNetMgr.seatIndex;
        btnChupai.active = isMyTurn;
        btnChupai.getComponent(cc.Button).interactable = isMyTurn;
    },

    //初始化反区域
    initFans:function(){
        for(var i=0;i<this._sanfanSprites.length;++i){
            this._sanfanSprites[i].active=false;
        }
        for(var i=0;i<this._wufanSprites.length;++i){
            this._wufanSprites[i].active=false;
        }

        var seats = cc.vv.gameNetMgr.seats;

        for(var i=0;i<seats.length;++i){
            var localIndex = cc.vv.gameNetMgr.getLocalIndex(seats[i].seatIndex);
            this.showFans(localIndex,seats[i].sanfans,seats[i].wufans);
        }
    },

    //初始化牌数
    initPaishu:function(){
        var seats = cc.vv.gameNetMgr.seats;
        
        for(var i=0;i<seats.length;++i){
            var localIndex = cc.vv.gameNetMgr.getLocalIndex(seats[i].seatIndex);
            var paishu = seats[i].paishu;
            this._paishuLabel[localIndex].string=paishu?paishu:"0";
        }
    },

    //显示出牌
    showChupai:function(userId,chupais){
        var seatIndex = cc.vv.gameNetMgr.getSeatIndexByID(userId);
        var localIndex = cc.vv.gameNetMgr.getLocalIndex(seatIndex);

        var chupaiNode = this._chupaiSprites[localIndex];
        chupaiNode.active = true;
        cc.vv.pokermgr.sortPK(chupais);
        var chupaiLen = chupais.length;
        if(localIndex == 3){    //左边
            for(var i=0;i<chupaiLen;++i){
                var pkid = chupais[i];
                var card = chupaiNode.children[i].getComponent("Card");
                card.node.active = true;
                if(card.node.getComponent(cc.Button)){
                    card.node.getComponent(cc.Button).interactable = false;
                }
                cc.vv.pokermgr.setCardByPKID(card,pkid);
            }
            for(var i=chupaiLen;i<chupaiNode.children.length;++i){
                var card = chupaiNode.children[i].getComponent("Card");
                card.node.active = false;
            }
        }else if(localIndex == 1){
            var hideLen = chupaiNode.children.length - chupaiLen;
            for(var i=0;i<hideLen;++i){
                var card = chupaiNode.children[i].getComponent("Card");
                card.node.active = false;
            }
            for(var i=0;i<chupaiLen;++i){
                var nodeIndex = i+hideLen;
                var pkid = chupais[i];
                var card = chupaiNode.children[nodeIndex].getComponent("Card");
                card.node.active = true;
                if(card.node.getComponent(cc.Button)){
                    card.node.getComponent(cc.Button).interactable = false;
                }
                cc.vv.pokermgr.setCardByPKID(card,pkid);
            }
        }else{
            var hideLen = chupaiNode.children.length - chupaiLen;
            for(var i=0;i<=Math.ceil(hideLen/2);++i){
                var card = chupaiNode.children[i].getComponent("Card");
                card.node.active = false;
                card = chupaiNode.children[chupaiNode.children.length-1-i].getComponent("Card");
                card.node.active = false;
            }
            for(var i=0;i<chupaiLen;++i){
                var nodeIndex = i + Math.floor(hideLen/2);
                var pkid = chupais[i];
                var card = chupaiNode.children[nodeIndex].getComponent("Card");
                card.node.active = true;
                if(card.node.getComponent(cc.Button)){
                    card.node.getComponent(cc.Button).interactable = false;
                }
                cc.vv.pokermgr.setCardByPKID(card,pkid);
            }
        }
    },

    //初始化两队比分
    initTeamVS:function(){
        var button = cc.vv.gameNetMgr.button;
        console.log('zhuang: '+button);
        if(button == -1){
            this._teamVS[0].getChildByName("zhuang").active=false;
            this._teamVS[0].getChildByName("score").active=false;
            this._teamVS[1].getChildByName("zhuang").active=false;
            this._teamVS[1].getChildByName("score").active=false;
            return;
        }

        var teamVS = cc.vv.gameNetMgr.teamVS;
        var zhuang = cc.vv.gameNetMgr.button % 2;
        var ke = 1 - zhuang;
        this._teamVS[zhuang].getChildByName("zhuang").active=true;
        this._teamVS[zhuang].getChildByName("score").active=false;
        this._teamVS[ke].getChildByName("zhuang").active=false;
        this._teamVS[ke].getChildByName("score").active=true;
        var score = this._teamVS[ke].getChildByName("score").getComponent(cc.Label);
        score.string = teamVS[ke] + "分";             
    },

    //检查IP
    checkIp:function(){
        if(cc.vv.gameNetMgr.gamestate == ''){
            return;
        }
        var selfData = cc.vv.gameNetMgr.getSelfData();
        var ipMap = {}
        for(var i = 0; i < cc.vv.gameNetMgr.seats.length; ++i){
            var seatData = cc.vv.gameNetMgr.seats[i];
            if(seatData.ip != null && seatData.userid > 0 && seatData != selfData){
                if(ipMap[seatData.ip]){
                    ipMap[seatData.ip].push(seatData.name);
                }
                else{
                    ipMap[seatData.ip] = [seatData.name];
                }
            }
        }
        
        for(var k in ipMap){
            var d = ipMap[k];
            if(d.length >= 2){
                var str = "" + d.join("\n") + "\n\n正在使用同一IP地址进行游戏!";
                cc.vv.alert.show("注意",str);
                return; 
            }
        }
    },

    //初始化扑克牌
    initPokers:function(){
        for(var i=0;i<this._myPKArr.length;++i){
            this._myPKArr[i].node.active=false; //初始化手牌不显示
        }

        var seats = cc.vv.gameNetMgr.seats;
        var seatData = seats[cc.vv.gameNetMgr.seatIndex];
        var holds = seatData.holds;
        if(holds==null){
            return;
        }
        cc.vv.pokermgr.sortPK(holds);
        //初始化手牌
        for(var i=0;i<holds.length;++i){
            var pkid = holds[i];
            var card = this._myPKArr[i];
            card.node.active=true;
            card.node.pkid=pkid;
            card.node.y=0;
            cc.vv.pokermgr.setCardByPKID(card,pkid);
            //初始化玩家选择的牌
            var index = this._selectedPokers.indexOf(pkid);
            if(index!=-1){
                card.node.y=15;
            }
        }

        //隐藏之后的部分
        for(var i=holds.length;i<this._myPKArr.length;++i){
            var card = this._myPKArr[i];
            card.node.active=false;
            delete card.node.pkid;
            card.node.y=0;
        }


    },

    //初始化显示主的区域
    initZhu:function(){
        var zhu = cc.vv.gameNetMgr.zhu;
        if(zhu != -1){
            this._zhu.node.active = true;
            this._zhu.spriteFrame = cc.vv.pokermgr.texSuitBig[zhu];
        }else{
            this._zhu.node.active = false;
        }
    },

    //初始化本轮出牌信息
    initLunType:function(){
        this._lunType.node.active = true;

        var gamestate = cc.vv.gameNetMgr.gamestate;
        if(gamestate == "qipai"){
            this._lunType.string = "起牌";
        }else if(gamestate == "dingzhu"){
            this._lunType.string = "定主";
        }else if(gamestate == "jingong"){
            var gong = cc.vv.gameNetMgr.gong;
            this._lunType.string = gong==1?"单进":gong==2?"双进":"";
        }else if(gamestate == "fandipai"){
            this._lunType.string = "翻底";
        }else if(gamestate == "koudipai"){
            this._lunType.string = "扣底"
        }else if(gamestate == "chupai"){
            this._lunType.string = "出牌";
            var curLunInfo = cc.vv.gameNetMgr.curLunInfo;
            if(curLunInfo != null || curLunInfo.curWinTurn != -1){
                var firstTurnInfo = curLunInfo.turnInfo[curLunInfo.firstTurn];
                if(firstTurnInfo)
                if(firstTurnInfo.type == "danpai"){
                    this._lunType.string = "单牌";
                }else if(firstTurnInfo.type == "shunpai"){
                    this._lunType.string = "顺牌";
                }else if(firstTurnInfo.type == "gangpai"){
                    this._lunType.string = firstTurnInfo.gangType?"真杠":"假杠";
                }
            }
        }
        
    },

    //起牌按钮点击选项
    onQipaiOptionClicked:function(event){
        console.log(event.target.pai);
        switch(event.target.name){
            case "btnGuo":{
                if(cc.vv.gameNetMgr.gamestate=='qipai'){
                    cc.vv.net.send("qipai_guo");
                }
                break;
            }
            case "heitao":{
                if(cc.vv.gameNetMgr.zhu == -1){
                    cc.vv.net.send("game_dingzhu",{suit:3});
                }
                break;
            }
            case "hongtao":{
                if(cc.vv.gameNetMgr.zhu == -1){
                    cc.vv.net.send("game_dingzhu",{suit:2});
                }
                break;
            }
            case "heimei":{
                if(cc.vv.gameNetMgr.zhu == -1){
                    cc.vv.net.send("game_dingzhu",{suit:1});
                }
                break;
            }
            case "fangkuai":{
                if(cc.vv.gameNetMgr.zhu == -1){
                    cc.vv.net.send("game_dingzhu",{suit:0});
                }
                break;
            }
            default:break;
        }
    },

    //扑克牌点击事件
    onPKClicked:function(event){

        cc.vv.audioMgr.playSFX("card_deal.mp3");
        console.log('poker clicked: '+event.target.pkid);

        var index = this._selectedPokers.indexOf(event.target.pkid);
        if(index != -1){
            this._selectedPokers.splice(index,1);
            event.target.y = 0;
        }else{
            this._selectedPokers.push(event.target.pkid);
            event.target.y = 15;
        }
        var gamestate = cc.vv.gameNetMgr.gamestate;
        if(gamestate != 'chupai'){
            this.checkCanFan();
            if(gamestate == 'koudipai'){
                this.checkCanKoudipai();
            }
        }
    },

    //检查是否可以反
    checkCanFan:function(){
        var btnFan = this._qipaiOptions.getChildByName('btnFan');
        btnFan.active = false;
        btnFan.getComponent(cc.Button).interactable = false;

        if(this._selectedPokers.length != 3){
            return;
        }

        var pai = this._selectedPokers[0];
        pai = cc.vv.pokermgr.getPoint(pai);
        if(pai != 3 && pai != 5){
            return;
        }
        for(var i=1;i<3;++i){
            var pai2 = cc.vv.pokermgr.getPoint(this._selectedPokers[i]);
            if(pai2 != pai){
                return;
            }
        }

        btnFan.active = true;
        btnFan.getComponent(cc.Button).interactable = true;
    },

    //检查是否可扣底牌
    checkCanKoudipai:function(){
        var btnKoudipai = this._qipaiOptions.getChildByName('btnKoudipai');
        btnKoudipai.active = false;
        btnKoudipai.getComponent(cc.Button).interactable = false;

        var localIndex = cc.vv.gameNetMgr.getLocalIndex(cc.vv.gameNetMgr.button);
        if(localIndex != 0){    //如果自己不是庄家，不能扣牌
            return;
        }
        //如果不是6张，不能扣牌
        if(this._selectedPokers.length != 6){
            return;
        }
        //如果有分牌，也不能扣牌
        for(var i=0;i<this._selectedPokers.length;++i){
            var pai = cc.vv.pokermgr.getPoint(this._selectedPokers[i]);
            if(pai == 5 || pai ==10 || pai == 13){
                return;
            }
        }

        btnKoudipai.active = true;
        btnKoudipai.getComponent(cc.Button).interactable = true;
    },

    //成反的按钮
    onBtnFanClicked:function(event){
        var data=this._selectedPokers;
        
        cc.vv.net.send('game_fan',data);

        var btnFan = this._qipaiOptions.getChildByName('btnFan');
        btnFan.active = false;
        btnFan.getComponent(cc.Button).interactable = false;
    },

    //庄家扣底牌的按钮
    onBtnKoudipaiClicked:function(event){
        var data=this._selectedPokers;
        this._selectedPokers = [];
        cc.vv.net.send('game_zhuang_koudipai',data);   //庄家扣底牌
        var btnKoudipai = this._qipaiOptions.getChildByName('btnKoudipai');
        btnKoudipai.active = false;
        btnKoudipai.getComponent(cc.Button).interactable = false;
    },

    //玩家点击出牌按钮
    onBtnChupaiClicked:function(event){
        console.log('selected pokers is: '+this._selectedPokers);
        if(this._selectedPokers == null || this._selectedPokers.length == 0){
            return;
        }
        cc.vv.net.send('chupai',this._selectedPokers);
    },

    //玩家点击成Q杠按钮
    onBtnQgangClicked:function(event){
        console.log('the choice is: '+ event.target.name);
        var choice = -1;
        if(event.target.name == "btnQzgang"){
            choice = 1; //真杠
        }else if(event.target.name == "btnQjgang"){
            choice = 0; //假杠
        }
        cc.vv.net.send('qgang',{choice:choice});
    },


    //显示反的区域
    showFans:function(localIndex,sanfans,wufans){

        this._sanfanSprites[localIndex].active = true;
        //三反
        cc.vv.pokermgr.sortPK(sanfans);
        for(var i=0;i<sanfans.length;++i){
            var card = this._sanfanSprites[localIndex].children[i];
            card.active = true;
            card.pkid = sanfans[i];
            card.y = 0;
            cc.vv.pokermgr.setCardByPKID(card.getComponent("Card"),sanfans[i]);
            if(localIndex == 0){
                card.getComponent(cc.Button).interactable = true;
            }
        }
        //隐藏之后的部分
        for(var i=sanfans.length;i<this._sanfanSprites[localIndex].children.length;++i){
            var card = this._sanfanSprites[localIndex].children[i].getComponent("Card");
            card.node.active=false;
            delete card.node.pkid;
            card.node.y=0;
        } 
        
        //五反
        this._wufanSprites[localIndex].active =true;
        cc.vv.pokermgr.sortPK(wufans);
        for(var i=0;i<wufans.length;++i){
            var card = this._wufanSprites[localIndex].children[i].getComponent("Card");
            card.node.active = true;
            card.node.pkid = wufans[i];
            card.node.y = 0;
            cc.vv.pokermgr.setCardByPKID(card,wufans[i]);
            if(localIndex == 0){
                card.node.getComponent(cc.Button).interactable = true;
            }
        }  
        //隐藏之后的部分
        for(var i=wufans.length;i<this._wufanSprites[localIndex].children.length;++i){
            var card = this._wufanSprites[localIndex].children[i].getComponent("Card");
            card.node.active=false;
            delete card.node.pkid;
            card.node.y=0;
        }         
    },

    //显示成Q杠选择按钮
    showBtnQgang:function(){
        var btnQzgang = this._chupaiOptions.getChildByName("btnQzgang");
        var btnQjgang = this._chupaiOptions.getChildByName("btnQjgang");
        btnQjgang.active = true;
        btnQjgang.getComponent(cc.Button).interactable = true;
        btnQzgang.active = true;
        btnQzgang.getComponent(cc.Button).interactable = true;

        var btnChupai = this._chupaiOptions.getChildByName("btnChupai");
        btnChupai.active = false;
        btnChupai.getComponent(cc.Button).interactable = false;

    },

    //显示进宫按钮
    showBtnJingong:function(){
        var btnJingong = this._qipaiOptions.getChildByName("btnJingong");
        btnJingong.active = false;
        if(cc.vv.gameNetMgr.gong == 0 || cc.vv.gameNetMgr.gamestate != "jingong"){
            return; //如果不进宫，返回
        }
        var seat = cc.vv.gameNetMgr.getSeatByID(cc.vv.userMgr.userId);
        if(seat.holds.length + seat.sanfans.length + seat.wufans.length<12){
            return; //小于12张手牌，返回
        }
        
        var lblJingong = btnJingong.getChildByName("Label").getComponent(cc.Label);
        var seatIndex = cc.vv.gameNetMgr.getSeatIndexByID(cc.vv.userMgr.userId);
        var zhuangIndex = cc.vv.gameNetMgr.button;
        //判断玩家是否需要进宫或退宫
        if(cc.vv.gameNetMgr.gong == 1){ //单进
            if(seatIndex == zhuangIndex){
                btnJingong.active = true;
                lblJingong.string = "退宫";
    
            }else if(seatIndex == (zhuangIndex+3)%4){
                btnJingong.active = true;
                lblJingong.string = "进宫";
            }
        }else{  //双进
            var zhuangTeam = zhuangIndex % 2;
            var seatTeam = seatIndex % 2;
            btnJingong.active = true;
            lblJingong.string = seatTeam==zhuangTeam?"退宫":"进宫";
        }
    },

    //进宫按钮点击事件
    onBtnJingongClicked:function(event){
        console.log("selected poker is: "+this._selectedPokers);
        if(this._selectedPokers.length != 1){
            return;
        }

        cc.vv.net.send("jingong",{pkId:this._selectedPokers[0]});
    },

    //点击革命按钮
    onBtnGemingClicked:function(event){
        console.log("geming clicked");
        cc.vv.net.send("geming");
    },

    onDestroy:function(){
        console.log("onDestroy");
        if(cc.vv){
            cc.vv.gameNetMgr.clear();   
        }
    }
});


