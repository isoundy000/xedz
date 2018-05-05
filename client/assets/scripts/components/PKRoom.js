
cc.Class({
    extends: cc.Component,

    properties: {

        lblRoomNo:{
            default:null,
            type:cc.Label
        },
        _preSeats:[],
        _btnChSeats:[],
        _gameSeats:[],
        _timeLabel:null,
    },

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        if(cc.vv==null){
            return;
        }
        //初始化视图
        this.initView();
        //初始化座位信息
        this.initSeats();
        //初始化监听事件处理
        this.initEventHandlers();
        //检测是否有未完成的位置交换请求
        cc.vv.net.send("test_change_seat_req");
        
    },

    start () {

    },

    initView:function(){
        var sides = ["myself","right","up","left"];
        //保存准备界面的座位
        var prepareChild = this.node.getChildByName("prepare");
        for(var i=0;i<sides.length;++i){
            var sideNode = prepareChild.getChildByName(sides[i]);
            var seat = sideNode.getChildByName("seat");
            this._preSeats.push(seat.getComponent("Seat"));
        }

        //更新按钮状态
        this.refreshBtns();

        this.lblRoomNo = cc.find("Canvas/info_bar/room_txt/room_num").getComponent(cc.Label);
        this.lblRoomNo.string=cc.vv.gameNetMgr.roomId;

        //保存游戏界面的座位
        var gameChild = this.node.getChildByName("game");
        for(var i=0;i<sides.length;++i){
            var sideNode = gameChild.getChildByName(sides[i]);
            var seat = sideNode.getChildByName("seat");
            this._gameSeats.push(seat.getComponent("Seat"));
        }
    },

    initSeats:function(){
        var seats = cc.vv.gameNetMgr.seats;
        //根据座位信息逐个初始化
        for(var i = 0; i < seats.length; ++i){
            this.initSingleSeat(seats[i]);
        }
    },

    refreshBtns:function(){
        var prepare = this.node.getChildByName("prepare");

        var sides=["right","up","left"];
        //四个与准备和交换位置有关的按钮
        for(var i=0;i<sides.length;++i){
            var sideNode=prepare.getChildByName(sides[i]);
            var btn=sideNode.getChildByName("btn_ch_seat");
            cc.vv.utils.addClickEvent(btn,this.node,"PKRoom","onBtnChSeatClicked");
            this._btnChSeats.push(btn);
        }

        //准备按钮监听
        var btnPrepare=prepare.getChildByName("myself").getChildByName("btn_ready");
        var btnLabel=btnPrepare.getChildByName("Label").getComponent(cc.Label);
        var seat=cc.vv.gameNetMgr.getSeatByID(cc.vv.userMgr.userId);
        btnLabel.string=seat.ready?"取消准备":"准备";
        cc.vv.utils.addClickEvent(btnPrepare,this.node,"PKRoom","onBtnPreClicked");



        var btnExit = prepare.getChildByName("btn_exit");
        var btnDissolve = prepare.getChildByName("btn_dissolve");
        var btnBack = prepare.getChildByName("btn_back");
        var isIdle = cc.vv.gameNetMgr.numOfGames == 0;

        cc.vv.utils.addClickEvent(btnDissolve,this.node,"PKRoom","onBtnDissolveClicked");
        cc.vv.utils.addClickEvent(btnBack,this.node,"PKRoom","onBtnBackClicked");
        cc.vv.utils.addClickEvent(btnExit,this.node,"PKRoom","onBtnExitClicked");
        btnExit.active = !cc.vv.gameNetMgr.isOwner() && isIdle;
        btnDissolve.active = cc.vv.gameNetMgr.isOwner() && isIdle;
        
        //初始化设置、聊天按钮点击事件
        var mgsSet = this.node.getChildByName("mgs_set_bg");
        var btnSettings = mgsSet.getChildByName("btn_settings");
        var btnChat = mgsSet.getChildByName("btn_chat");
        cc.vv.utils.addClickEvent(btnSettings,this.node,"PKRoom","onBtnSettingsClicked");
        cc.vv.utils.addClickEvent(btnChat,this.node,"PKRoom","onBtnChatClicked");
    },

    initEventHandlers:function(){
        var self = this;

        this.node.on('user_state_changed',function(data){
            self.initSingleSeat(data.detail);
        });

        this.node.on('new_user',function(data){
            console.log(data);
            self.initSingleSeat(data.detail);   //data.detail 才是数据
        });

        this.node.on('wait_change_seat',function(data){
            console.log(data);
            data=data.detail;
            if(data.fromIndex == cc.vv.gameNetMgr.seatIndex){
                cc.vv.wc.show("请等待对方确认...");
            }else{
                cc.vv.wc.show("有玩家正在交换位置，请稍后");
            }
            setTimeout(function(){
                data.canChange = false;
                cc.vv.net.send("change_seat",data);
            },5000);
        });

        this.node.on('change_seat_req',function(data){
            console.log(data);
            data=data.detail;
            if(data.toIndex != cc.vv.gameNetMgr.seatIndex){
                return;
            }
            var seats = cc.vv.gameNetMgr.seats;
            var fromSeats = seats[data.fromIndex];
            cc.vv.alert.show("交换位置",data.fromIndex+"号玩家"+fromSeats.name+
            "请求和你交换位置，\n请确认是否同意？",function(){
                console.log("agree change seat");
                data.canChange=true;
                cc.vv.net.send("change_seat",data);
            },true,function(){
                console.log("refuse change seat");
                data.canChange=false;
                cc.vv.net.send("change_seat",data);
            })

        });

        this.node.on('change_seat_result',function(){
            self.initSeats();
            
        });

        this.node.on('prepare_change',function(data){
            data=data.detail;
            if(data.userId==cc.vv.userMgr.userId){
                var prepare = self.node.getChildByName("prepare");
                var btnPrepare=prepare.getChildByName("myself").getChildByName("btn_ready");
                var btnLabel=btnPrepare.getChildByName("Label").getComponent(cc.Label);
                btnLabel.string=data.ready?"取消准备":"准备";
            }
            var realIndex = cc.vv.gameNetMgr.getSeatIndexByID(data.userId);
            var localIndex=cc.vv.gameNetMgr.getLocalIndex(realIndex);
            self._preSeats[localIndex].setReady(data.ready);
            self._preSeats[localIndex].refresh();
            
        });

        this.node.on('game_begin',function(data){
            self.refreshBtns();
            self.initSeats();
        });

        //更新座位庄家信息
        this.node.on('game_zhuang_notified',function(){
            console.log('game_zhuang_notified');
            
            var zhuang = cc.vv.gameNetMgr.button;
            console.log('zhuang: '+zhuang);
            var index = cc.vv.gameNetMgr.getLocalIndex(zhuang);
            self._gameSeats[index].setZhuang(true);
            self._gameSeats[index].refresh();
        });

        //普通聊天
        this.node.on('chat_push',function(data){
            var data = data.detail;
            var idx = cc.vv.gameNetMgr.getSeatIndexByID(data.sender);
            var localIdx = cc.vv.gameNetMgr.getLocalIndex(idx);
            self._preSeats[localIdx].chat(data.content);
            self._gameSeats[localIdx].chat(data.content);
        });

        //快速聊天
        this.node.on('quick_chat_push',function(data){
            var data = data.detail;
            var idx = cc.vv.gameNetMgr.getSeatIndexByID(data.sender);
            var localIdx = cc.vv.gameNetMgr.getLocalIndex(idx);
            
            var index = data.content;
            var info = cc.vv.chat.getQuickChatInfo(index);
            self._preSeats[localIdx].chat(info.content);
            self._gameSeats[localIdx].chat(info.content);
            
            cc.vv.audioMgr.playSFX(info.sound);
        });

        this.node.on('emoji_push',function(data){
            var data = data.detail;
            var idx = cc.vv.gameNetMgr.getSeatIndexByID(data.sender);
            var localIdx = cc.vv.gameNetMgr.getLocalIndex(idx);
            console.log(data);
            self._preSeats[localIdx].emoji(data.content);
            self._gameSeats[localIdx].emoji(data.content);
        });
    },

    initSingleSeat:function(seat){
        var index = cc.vv.gameNetMgr.getLocalIndex(seat.seatIndex);
        var isOffline = !seat.online;
        var isZhuang = seat.seatIndex == cc.vv.gameNetMgr.button;
        
        console.log("isOffline:" + isOffline);
        
        this._preSeats[index].setName(seat.name);
        this._preSeats[index].setReady(seat.ready);
        this._preSeats[index].setOffline(isOffline);
        this._preSeats[index].setID(seat.userid);
        this._preSeats[index].setDui(seat.seatIndex%2);
        this._preSeats[index].refresh();
        
        this._gameSeats[index].setName(seat.name);
        this._gameSeats[index].setZhuang(isZhuang);
        this._gameSeats[index].setOffline(isOffline);
        this._gameSeats[index].setID(seat.userid);
        this._gameSeats[index].setDui(seat.seatIndex%2);
        this._gameSeats[index].refresh();

        if(index!=0){
            this._btnChSeats[index-1].active = seat.userid > 0 && seat.online;
        }
    },

    //根据target对象获取所在本地位置序号
    getLocalIndexFromBtn(target){
        for(var i=0;i<this._btnChSeats.length;++i){
            if(this._btnChSeats[i]==target){
                return i+1;
            }
        }
    },

    onBtnDissolveClicked:function(){
        cc.vv.alert.show("解散房间","解散房间不扣房卡，\n是否确定解散？",function(){
            cc.vv.net.send("dispress");    
        },true);
    },

    onBtnBackClicked:function(){
        cc.vv.alert.show("返回大厅","返回大厅房间仍会保留，\n快去邀请大伙来玩吧！",function(){
            cc.vv.wc.show('正在返回游戏大厅');
            cc.director.loadScene("hall");    
        },true);
    },

    onBtnExitClicked:function(){
        cc.vv.net.send("exit");
    },

    onBtnSettingsClicked:function(){
        cc.vv.popupMgr.showSettings();   
    },

    onBtnChatClicked:function(){
        cc.vv.chat.showChat();
    },

    onBtnChSeatClicked:function(event){
        var localIndex=this.getLocalIndexFromBtn(event.target);
        var realIndex=cc.vv.gameNetMgr.getRealIndex(localIndex);
        console.log("真实的座位号是："+realIndex);
        var data = {
            userId:cc.vv.userMgr.userId,
            roomId:cc.vv.gameNetMgr.roomId,
            fromIndex:cc.vv.gameNetMgr.seatIndex,
            toIndex:realIndex
        };
        cc.vv.net.send("change_seat_req",data);
    },

    onBtnPreClicked:function(event){
        var seat=cc.vv.gameNetMgr.getSeatByID(cc.vv.userMgr.userId);
        cc.vv.net.send("prepare_change",{ready:!seat.ready});
    },





    // update (dt) {},
});
