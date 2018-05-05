cc.Class({
    extends: cc.Component,

    properties: {
        dataEventHandler:null,   //MJGame.js
        roomId:null,
        maxNumOfGames:0,
        numOfGames:0,
        numOfPK:0,
        seatIndex:-1,
        seats:null,
        turn:-1,
        button:-1,
        gamestate:"",
        isOver:false,
        dissoveData:null,   //解散房间信息
        zhu:-1,
        teamVS:null,
        curLunInfo:null,    //当前轮次出牌信息
        gong:0, //进宫信息
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
    },
    
    reset:function(){
        this.numOfPK = 0,
        this.gamestate = "";
        this.turn = -1;
        this.button = -1;
        this.zhu = -1,
        this.teamVS = [0,0];
        this.curLunInfo = null;
        this.gong = 0;
        for(var i = 0; i < this.seats.length; ++i){
            this.seats[i].holds = [];
            this.seats[i].folds = [];
            this.seats[i].sanfans = [];
            this.seats[i].wufans = [];
            this.seats[i].score = 0;
            this.seats[i].canDingzhus = [false,false,false,false];
            this.seats[i].canChupai = false;     
            this.seats[i].paishu = 0; 
            this.seats[i].canGeming = false;
        }
    },
    
    clear:function(){
        this.dataEventHandler = null;
        if(this.isOver == null){
            this.seats = null;
            this.roomId = null;
            this.maxNumOfGames = 0;
            this.numOfGames = 0;   
            this.teamVS = [0,0];     
            this.gong = 0;
        }
    },
    
    dispatchEvent(event,data){
        console.log(event);
        if(this.dataEventHandler){
            this.dataEventHandler.emit(event,data);
        }    
    },
    
    getSeatIndexByID:function(userId){
        for(var i = 0; i < this.seats.length; ++i){
            var s = this.seats[i];
            if(s.userid == userId){
                return i;
            }
        }
        return -1;
    },
    
    isOwner:function(){
        return this.conf.creator==cc.vv.userMgr.userId;
    },
    
    getSeatByID:function(userId){
        var seatIndex = this.getSeatIndexByID(userId);
        var seat = this.seats[seatIndex];
        return seat;
    },
    
    getSelfData:function(){
        return this.seats[this.seatIndex];
    },
    
    getLocalIndex:function(index){
        var ret = (index - this.seatIndex + 4) % 4;
        return ret;
    },

    getRealIndex:function(localIndex){
        var ret = (this.seatIndex + localIndex) % 4;
        return ret;
    },
    
    prepareReplay:function(roomInfo,detailOfGame){
        this.roomId = roomInfo.id;
        this.seats = roomInfo.seats;
        this.turn = detailOfGame.base_info.button;
        var baseInfo = detailOfGame.base_info;
        for(var i = 0; i < this.seats.length; ++i){
            var s = this.seats[i];
            s.seatIndex = i;
            s.score = null;
            s.holds = baseInfo.game_seats[i];
            s.pengs = [];
            s.angangs = [];
            s.diangangs = [];
            s.wangangs = [];
            s.folds = [];
            console.log(s);
            if(cc.vv.userMgr.userId == s.userid){
                this.seatIndex = i;
            }
        }
        this.conf = {
            type:baseInfo.type,
        }
        if(this.conf.type == null){
            this.conf.type == "xedz";
        }
    },
    
    
    initHandlers:function(){
        var self = this;
        cc.vv.net.addHandler("login_result",function(data){
            console.log(data);
            if(data.errcode === 0){
                var data = data.data;
                self.roomId = data.roomid;
                self.conf = data.conf;
                self.maxNumOfGames = data.conf.maxGames;
                self.numOfGames = data.numofgames;
                self.seats = data.seats;
                self.seatIndex = self.getSeatIndexByID(cc.vv.userMgr.userId);
                self.isOver = false;
            }
            else{
                console.log(data.errmsg);   
            }
            self.dispatchEvent('login_result');
        });
                
        cc.vv.net.addHandler("login_finished",function(data){
            console.log("login_finished");
            cc.director.loadScene("pkgame",function(){
                cc.vv.net.ping();
                cc.vv.wc.hide();
                self.dispatchEvent("login_finished");
            });
            
        });

        cc.vv.net.addHandler("exit_result",function(data){
            self.roomId = null;
            self.turn = -1;
            self.dingque = -1;
            self.isDingQueing = false;
            self.seats = null;
        });
        
        cc.vv.net.addHandler("exit_notify_push",function(data){
           var userId = data;
           var s = self.getSeatByID(userId);
           if(s != null){
               s.userid = 0;
               s.name = "";
               self.dispatchEvent("user_state_changed",s);
           }
        });
        
        cc.vv.net.addHandler("dispress_push",function(data){
            self.roomId = null;
            self.turn = -1;
            self.dingque = -1;
            self.isDingQueing = false;
            self.seats = null;
        });
                
        cc.vv.net.addHandler("disconnect",function(data){
            if(self.roomId == null){
                cc.vv.wc.show('正在返回游戏大厅');
                cc.director.loadScene("hall");
            }
            else{
                if(self.isOver == false){
                    cc.vv.userMgr.oldRoomId = self.roomId;
                    self.dispatchEvent("disconnect");                    
                }
                else{
                    self.roomId = null;
                }
            }
        });
        
        cc.vv.net.addHandler("new_user_comes_push",function(data){
            //console.log(data);
            var seatIndex = data.seatIndex;
            var needCheckIp = false;
            if(self.seats[seatIndex].userid > 0){
                self.seats[seatIndex].online = true;
                if(self.seats[seatIndex].ip != data.ip){
                    self.seats[seatIndex].ip = data.ip;
                    needCheckIp = true;
                }
            }
            else{
                data.online = true;
                self.seats[seatIndex] = data;
                needCheckIp = true;
            }
            self.dispatchEvent('new_user',self.seats[seatIndex]);
            
            if(needCheckIp){
                self.dispatchEvent('check_ip',self.seats[seatIndex]);
            }
        });
        //用户状态改变（是否在线）
        cc.vv.net.addHandler("user_state_push",function(data){
            //console.log(data);
            var userId = data.userid;
            var seat = self.getSeatByID(userId);
            seat.online = data.online;
            self.dispatchEvent('user_state_changed',seat);
        });
        
        cc.vv.net.addHandler("user_ready_push",function(data){
            //console.log(data);
            var userId = data.userid;
            var seat = self.getSeatByID(userId);
            seat.ready = data.ready;
            self.dispatchEvent('user_state_changed',seat);
        });
        
        //接收玩家自己的手牌信息
        cc.vv.net.addHandler("game_holds_push",function(data){
            var seat = self.seats[self.seatIndex]; 
            console.log(data);
            seat.holds = data;  //持有的牌
            
            //初始化手牌相关信息
            for(var i = 0; i < self.seats.length; ++i){
                var s = self.seats[i]; 
                //打出的牌
                s.folds = [];
                //三反
                s.sanfans = [];
                //五反
                s.wufans = [];
                //定主信息
                s.canDingzhus = [false,false,false,false];
                s.canGeming = false;
                s.canChupai = false;    //是否可以出牌
                s.socre = 0;    //分数
                s.paishu = 0;   //牌数
                s.ready = false;    //准备为false
            }
            self.dispatchEvent('game_holds');   //通知 dataEventHandler 'game_holds'事件
        });
         
        cc.vv.net.addHandler("game_begin_push",function(data){
            console.log('game_begin_push');
            console.log(data);
            if(self.button!=-1)
            self.button = -1;
            self.zhu = -1;
            self.teamVS = [0,0];
            self.curLunInfo = {
                firstTurn:data,    //本轮首位出牌玩家
                curTurn:data,  //当前出牌玩家
                curWinTurn:-1,  //本轮当前赢牌玩家
                turnInfo:[],    //本轮已出牌信息
            };
            self.gong = 0;
            self.turn = data;
            self.gamestate = "begin";
            self.dispatchEvent('game_begin');
        });
        
        cc.vv.net.addHandler("game_playing_push",function(data){
            console.log('game_playing_push'); 
            self.gamestate = "playing"; 
            self.dispatchEvent('game_playing');
        });
        
        //同步游戏信息
        cc.vv.net.addHandler("game_sync_push",function(data){
            console.log("game_sync_push");
            console.log(data);
            self.numOfPK = data.numofPK;
            self.gamestate = data.state;
            
            self.turn = data.turn;
            self.button = data.button;
            self.zhu = data.zhu;
            self.teamVS = data.teamVS;
            self.curLunInfo = data.curLunInfo;
            self.gong = data.gong;
            for(var i = 0; i < 4; ++i){
                var seat = self.seats[i];
                var sd = data.seats[i];
                seat.holds = sd.holds;
                if(seat.holds){
                    self.doZhupai(seat.holds,self.zhu);
                }
                seat.folds = sd.folds;
                seat.sanfans = sd.sanfans;
                seat.wufans = sd.wufans;
                seat.score = sd.score;
                seat.canDingzhus = sd.canDingzhus;
                seat.canChupai = sd.canChupai;     
                seat.paishu = sd.paishu; 
                seat.canGeming = sd.canGeming;
           }
           self.dispatchEvent('game_sync');
        });
        
        cc.vv.net.addHandler("game_action_push",function(data){
            self.curaction = data;
            console.log(data);
            self.dispatchEvent('game_action',data);
        });
        
        //进入出牌阶段，通知玩家出牌
        cc.vv.net.addHandler("game_chupai_push",function(data){
            console.log('game_chupai_push');
            //console.log(data);
            var turnUserID = data;
            var si = self.getSeatIndexByID(turnUserID);
            console.log("current turn: "+si);
            if(self.gamestate != "chupai"){
                self.gamestate = "chupai";
            }
            if(self.curLunInfo == null){
                self.curLunInfo = {
                    firstTurn:si,    //本轮首位出牌玩家
                    curTurn:si,  //当前出牌玩家
                    curWinTurn:-1,  //本轮当前赢牌玩家
                    turnInfo:[],    //本轮已出牌信息
                };
            }
            self.doTurnChange(si);
        });
        
        cc.vv.net.addHandler("game_num_push",function(data){
            self.numOfGames = data;
            self.dispatchEvent('game_num',data);
        });

        cc.vv.net.addHandler("game_over_push",function(data){
            console.log('game_over_push');
            self.reset();
        });
        
        cc.vv.net.addHandler("game_chupai_notify_push",function(data){
            var userId = data.userId;
            var pai = data.pai;
            var si = self.getSeatIndexByID(userId);
            self.doChupai(si,pai);
        });
        
        
        cc.vv.net.addHandler("guo_notify_push",function(data){
            console.log('guo_notify_push');
            var userId = data.userId;
            var pai = data.pai;
            var si = self.getSeatIndexByID(userId);
            self.doGuo(si,pai);
        });   
        
        cc.vv.net.addHandler("chat_push",function(data){
            self.dispatchEvent("chat_push",data);    
        });
        
        cc.vv.net.addHandler("quick_chat_push",function(data){
            self.dispatchEvent("quick_chat_push",data);
        });
        
        cc.vv.net.addHandler("emoji_push",function(data){
            self.dispatchEvent("emoji_push",data);
        });
        
        //通知解散房间信息
        cc.vv.net.addHandler("dissolve_notice_push",function(data){
            console.log("dissolve_notice_push"); 
            console.log(data);
            self.dissoveData = data;
            self.dispatchEvent("dissolve_notice",data);
        });
        
        cc.vv.net.addHandler("dissolve_cancel_push",function(data){
            self.dissoveData = null;
            self.dispatchEvent("dissolve_cancel",data);
        });
        
        cc.vv.net.addHandler("voice_msg_push",function(data){
            self.dispatchEvent("voice_msg",data);
        });

        /*
         * poker game self defined handlers
         */
        cc.vv.net.addHandler("wait_change_seat_push",function(data){
            console.log("wait_change_seat_push"); 
            self.dispatchEvent("wait_change_seat",data);
        });

        cc.vv.net.addHandler("change_seat_req_push",function(data){
            console.log("change_seat_req_push");
            self.dispatchEvent("change_seat_req",data);
        });

        cc.vv.net.addHandler("change_seat_result",function(data){
            console.log("change_seat_result");
            console.log(data);
            cc.vv.wc.hide();
            if(data.errcode == 0){
                cc.vv.alert.show("交换位置","交换成功",null,false);

                var data = data.data;
                self.seats = data.seats;
                self.seatIndex = self.getSeatIndexByID(cc.vv.userMgr.userId);
            }
            else{
                console.log(data.errmsg);   
                cc.vv.alert.show("交换位置",data.errmsg,null,false);
            }
            self.dispatchEvent("change_seat_result");
        });

        cc.vv.net.addHandler("prepare_change_push",function(data){
            if(data.errcode == 0){
                data=data.data;
                var seat=self.getSeatByID(data.userId);
                seat.ready=data.ready;
                self.dispatchEvent("prepare_change",data);
            }
        });

        cc.vv.net.addHandler("game_qipai_push",function(data){
            console.log('game_qipai_push');
            if(self.gamestate != 'qipai'){
                self.gamestate = 'qipai';
            }
            self.doQipai(self.seatIndex,data);
        });

        cc.vv.net.addHandler("game_qipai_wait_push",function(data){
            console.log('game_qipai_wait_push');
            if(self.gamestate != 'qipai'){
                self.gamestate = 'qipai';
            }
            var turnUserID = data;
            var si = self.getSeatIndexByID(turnUserID);
            self.doQipaiTurnChange(si);
        });

        cc.vv.net.addHandler("game_paishu_notified_push",function(data){
            console.log('game_paishu_notified_push');
            var seat = self.seats[data.seatIndex];
            seat.paishu=data.paishu;
            self.dispatchEvent('game_paishu_notified',data);
        });

        cc.vv.net.addHandler("qipai_finished_push",function(data){
            console.log('qipai_finished_push');
            self.gamestate='qipai_finished';
            var turnUserID = data;
            var si = self.getSeatIndexByID(turnUserID);

            self.turn = si;

            self.dispatchEvent('qipai_finished',{turn:si});

        });

        cc.vv.net.addHandler("can_dingzhu_push",function(data){
            console.log('can_dingzhu_push');
            var seat = self.getSeatByID(cc.vv.userMgr.userId);
            seat.canDingzhus[data] = true;
            self.dispatchEvent('can_dingzhu',data);
        });

        //
        cc.vv.net.addHandler("game_dingzhu_notified_push",function(data){
            console.log('game_dingzhu_notified_push');
            var userId = data.userId;   //定主的玩家id
            var zhu = data.zhu; //所定主花色
            self.zhu = zhu; //定主
            var seat = self.getSeatByID(cc.vv.userMgr.userId);
            seat.canDingzhus = [false,false,false,false];
            self.doZhupai(seat.holds,zhu);    //将手牌中的主牌进行变化
            self.dispatchEvent('game_dingzhu_notified',data);

        });

        cc.vv.net.addHandler("game_zhuang_notified_push",function(data){
            console.log('game_zhuang_notified_push');
            self.button = data; //庄家座位序号
            console.log('cur button: '+self.button);
            self.teamVS = [0,0];    //初始化两队比分信息
            self.dispatchEvent('game_zhuang_notified');
        });

        cc.vv.net.addHandler("game_dingzhu_push",function(data){
            console.log('game_dingzhu_push');
            self.gamestate = 'dingzhu';
            self.dispatchEvent('game_dingzhu');

        });

        //更新玩家手牌,仅影响holds
        cc.vv.net.addHandler("game_holds_update_push",function(data){
            console.log('game_holds_update_push');
            var seat = self.getSeatByID(cc.vv.userMgr.userId);
            seat.holds = data;
            self.dispatchEvent('game_holds');

        });

        //通知玩家某玩家所成的反
        cc.vv.net.addHandler("game_fan_notified_push",function(data){
            console.log('game_fan_notified_push');
            var seat = self.getSeatByID(data.userId);
            seat.sanfans = data.sanfans;
            seat.wufans = data.wufans;
            data.localIndex = self.getLocalIndex(seat.seatIndex);
            self.dispatchEvent('game_fan_notified',data);
        });

        //通知进入庄家扣底牌阶段
        cc.vv.net.addHandler("game_koudipai_notified_push",function(data){
            console.log('game_koudipai_notified_push');
            self.button = data.button;
            self.turn = data.button;
            self.gamestate = data.gamestate;
            self.dispatchEvent('game_koudipai_notified',data);
        });

        //通知所有玩家庄家所扣底牌完成
        cc.vv.net.addHandler("game_koudipai_finished_push",function(data){
            console.log('game_koudipai_finished_push');
            self.dispatchEvent('game_koudipai_finished',data.koupais);
        });

        //通知所有玩家出牌完成
        cc.vv.net.addHandler("game_chupai_notified_push",function(data){
            console.log('game_chupai_notified_push');
            self.dispatchEvent('game_chupai_notified',data);
        });

        //通知所有玩家两队得分
        cc.vv.net.addHandler("team_score_push",function(data){
            console.log('team_score_push');
            self.teamVS = data;
            self.dispatchEvent('team_score');
        });

        //通知所有玩家轮次信息
        cc.vv.net.addHandler("game_luninfo_push",function(data){
            console.log('game_luninfo_push');
            self.curLunInfo = data;
            self.dispatchEvent('game_luninfo');
        });

        //通知玩家选择出Q真杠还是Q假杠
        cc.vv.net.addHandler("choice_qgang_push",function(data){
            console.log('choice_qgang_push');
            self.dispatchEvent('choice_qgang');
        });

        //通知玩家翻底牌定主
        cc.vv.net.addHandler("game_fandipai_dingzhu_push",function(data){
            console.log('game_fandipai_dingzhu_push');
            self.gamestate = 'fandipai';
            self.dispatchEvent('game_fandipai_dingzhu');
        });

        //通知玩家翻底牌定主完成
        cc.vv.net.addHandler("fandipai_dingzhu_finished_push",function(data){
            console.log('fandipai_dingzhu_finished_push');
            self.dispatchEvent('fandipai_dingzhu_finished',data);
        });

        //通知玩家进入进宫阶段
        cc.vv.net.addHandler("game_jingong_push",function(data){
            console.log('game_jingong_push');
            self.gamestate = "jingong";
            self.gong = data;
            self.dispatchEvent('game_jingong');
        });

        //通知玩家进宫成功
        cc.vv.net.addHandler("jingong_succeed_push",function(data){
            console.log('jingong_succeed_push');
            self.dispatchEvent('jingong_succeed');
        });

        //通知玩家进宫信息更新
        cc.vv.net.addHandler("game_gong_notified_push",function(data){
            console.log('game_gong_notified_push');
            self.gong = data;
            self.dispatchEvent('game_jingong');
        });

        //通知玩家可以革命
        cc.vv.net.addHandler("can_geming_push",function(data){
            console.log('can_geming_push');
            var seat = self.getSeatByID(cc.vv.userMgr.userId);
            seat.canGeming = true;
            self.dispatchEvent('can_geming');
        });

        //通知玩家本局被革命
        cc.vv.net.addHandler("geming_notified_push",function(data){
            console.log('geming_notified_push');
            var seat = self.getSeatByID(data.userId);
            var content = "玩家"+seat.name+"革命";
            cc.vv.wc.show(content);
            setTimeout(function(){
                cc.vv.wc.hide();
            },1000);
        })
    },
    
    doGuo:function(seatIndex,pai){
        var seatData = this.seats[seatIndex];
        var folds = seatData.folds;
        folds.push(pai);
        this.dispatchEvent('guo_notify',seatData);    
    },
    
    //做玩家起牌操作
    doQipai:function(seatIndex,pai){
        var seatData = this.seats[seatIndex];
        if(seatData.holds){
            if(this.zhu != -1 && this.getSuit(pai) == this.zhu){
                pai = this.toZhupai(pai);
            }
            seatData.holds.push(pai);
            
            this.dispatchEvent('game_qipai',{seatIndex:seatIndex,pai:pai});            
        }
    },

    doTurnChange:function(si){
        this.turn = si;
        this.curLunInfo.curTurn = si;
        this.dispatchEvent('game_chupai');
    },
    
    doChupai:function(seatIndex,pai){
        this.chupai = pai;
        var seatData = this.seats[seatIndex];
        if(seatData.holds){             
            var idx = seatData.holds.indexOf(pai);
            seatData.holds.splice(idx,1);
        }
        this.dispatchEvent('game_chupai_notify',{seatData:seatData,pai:pai});    
    },
    
    //可动作玩家发生改变，改变轮次。
    doQipaiTurnChange:function(si){
        var data = {
            last:this.turn,
            turn:si,
        }
        this.turn = si;
        this.dispatchEvent('game_qipai_wait',data);
    },

    //处理主花色的牌
    doZhupai:function(holds,zhu){
        if(zhu == -1){
            return;
        }
        for(var i=0;i<holds.length;++i){
            if(this.getSuit(holds[i]) == zhu){
                holds[i] = this.toZhupai(holds[i]);
            }
        }

    },

    //得到扑克花色
    getSuit:function(poker){
        if(poker<160){
            return (Math.floor(poker/20)%4);    //普通牌suit=(pkid/20)%4
        }else if(poker<170){
            return (poker-160)%4;
        }else if(poker<180){
            return (poker-170)%4;
        }else if(poker==180){
            return 3;
        }else if(poker==183){
            return 0;
        }else if(poker==181 || poker==182){
            return poker-181+4;
        }else{
            return -1;
        }
    },

    toZhupai:function(poker){
        if(poker<80){
            return poker+80;
        }else if(poker>=160 && poker<164){
            return poker+4;
        }else if(poker>=170 && poker<174){
            return poker+4;
        }else{
            return poker;
        }
    },    
        
    
    connectGameServer:function(data){
        this.dissoveData = null;
        cc.vv.net.ip = data.ip + ":" + data.port;   //游戏服务器客户端ip
        console.log(cc.vv.net.ip);
        var self = this;

        var onConnectOK = function(){
            console.log("onConnectOK");
            var sd = {
                token:data.token,
                roomid:data.roomid,
                time:data.time,
                sign:data.sign,
            };
            cc.vv.net.send("login",sd);
        };
        
        var onConnectFailed = function(){
            console.log("failed.");
            cc.vv.wc.hide();
        };
        cc.vv.wc.show("正在进入房间");
        cc.vv.net.connect(onConnectOK,onConnectFailed);
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});
