var roomMgr = require("./roommgr");
var userMgr = require("./usermgr");
var pkutils = require("./pkutils");
var db = require("../utils/db");
var crypto = require("../utils/crypto");

var games = {};
var gamesIdBase = 0;

var gameSeatsOfUsers = {};


exports.setReady = function(userId,callback){
    var roomId = roomMgr.getUserRoom(userId);
    if(roomId == null){
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return;
    }

    //roomMgr.setReady(userId,true);

    var game = games[roomId];
    console.log(userId + " " +game);
    if(game == null){
        if(roomInfo.seats.length == 4){
            for(var i = 0; i < roomInfo.seats.length; ++i){
                var s = roomInfo.seats[i];
                if(s.ready == false || userMgr.isOnline(s.userId)==false){
                    return;
                }
            }
            //4个人到齐了，并且都准备好了，则开始新的一局
            exports.begin(roomId);
        }
    }
    else{   //如果服务器有游戏记录，恢复
        var numOfPK = game.pokers.length - game.currentIndex;
        var remainingGames = roomInfo.conf.maxGames - roomInfo.numOfGames;

        var data = {
            state:game.state,
            numofPK:numOfPK,
            button:game.button, //庄
            turn:game.turn,
            chupais:game.chupais,
            zhu:game.zhu,    //主花色
            teamVS:game.teamVS,
            gong:game.gong,
            dipais:game.dipais,
            curLunInfo:game.curLunInfo,
        };

        data.seats = [];
        var seatData = null;
        for(var i = 0; i < 4; ++i){
            var sd = game.gameSeats[i];

            var s = {
                userid:sd.userId,
                sanfans:sd.sanfans,
                wufans:sd.wufans,
                score:sd.score,
                paishu:sd.holds.length,
            }
            if(sd.userId == userId){
                s.holds = sd.holds;
                s.canDingzhus = sd.canDingzhus;
                s.canChuPai = sd.canChuPai;
                s.canGeming = sd.canGeming;
                seatData = sd;
            }
            data.seats.push(s);
        }

        //同步整个信息给客户端
        userMgr.sendMsg(userId,'game_sync_push',data);
        //sendOperations(game,seatData,game.chupai);
    }
};


//开始新的一局
exports.begin = function(roomId) {
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return;
    }
    var seats = roomInfo.seats;

    var game = {
        conf:roomInfo.conf, //游戏（房间）配置
        roomInfo:roomInfo,  //房间信息
        gameIndex:roomInfo.numOfGames,  //游戏当前局数

        button:-1, //庄
        pokers:new Array(54),   //扑克牌数组
        currentIndex:0, //当前牌序号序号
        gameSeats:new Array(4), //游戏座位数组
        turn:-1, //轮到谁出牌
        state:"idle",   //游戏状态
        chupais:null,  //出牌信息
        chupaiCnt:0,    //出牌数目
        actionList:[],  //动作列表记录
        zhu:-1, //当前游戏的主花色
        gong:0, //进宫信息
        gongInfo:[],    //进宫的牌信息
        dipais:[],
        teamVS:[0,0],  //两队比分信息
        curLunInfo:null,    //当前轮次信息
    };

    roomInfo.numOfGames++;

    for(var i = 0; i < 4; ++i){
        var data = game.gameSeats[i] = {};

        data.game = game;

        data.seatIndex = i;

        data.userId = seats[i].userId;
        //持有的牌
        data.holds = [];
        //打出的牌
        data.folds = [];
        //是否可以出牌
        data.canChuPai = false;
        //游戏动作记录
        data.actions = [];
        data.score = 0; //得分
        data.canDingzhus = [false,false,false,false];   //是否可以定主花色
        data.sanfans = [];  //三反牌
        data.wufans = [];   //五反牌
        data.canGeming = false;
        gameSeatsOfUsers[data.userId] = data;
    }
    games[roomId] = game; //存储游戏对象
    console.log('shuffle');
    //洗牌
    shuffle(game);

    //定先手,如果有指定下一个起牌者，则使用
    game.turn=(roomInfo.nextTurn!=null?roomInfo.nextTurn:initTurn());
    game.button=(roomInfo.nextButton!=null?roomInfo.nextButton:-1);
    game.gong=(roomInfo.nextGong!=null?roomInfo.nextGong:0);
    var numOfPK = game.pokers.length - game.currentIndex;

    for(var i = 0; i < seats.length; ++i){
        //开局时，通知前端必要的数据
        var s = seats[i];


        //通知玩家手牌,初始为空手牌
        userMgr.sendMsg(s.userId,'game_holds_push',game.gameSeats[i].holds);

        //通知游戏开始
        userMgr.sendMsg(s.userId,'game_begin_push',game.turn);

        //通知玩家庄家信息
        console.log('current button is '+game.button);
        if(game.button != -1){
            console.log('zhuang: '+game.button);
            userMgr.sendMsg(s.userId,'game_zhuang_notified_push',game.button);
        }

        //通知还剩多少张牌
        //userMgr.sendMsg(s.userId,'mj_count_push',numOfPK);
        //通知当前局数
        //userMgr.sendMsg(s.userId,'game_num_push',roomInfo.numOfGames);
    }

    game.state="qipai";
    doUserQipai(game);
};

function doUserQipai(game){
    game.chupai={};
    var turnSeat = game.gameSeats[game.turn];
    var pai = qipai(game,game.turn);
    //牌摸得还剩6张底牌，另作处理
    if(pai == -1){
        //此处当还剩6张底牌，另作处理
        doQipaiFinish(game,turnSeat.userId);
        return;
    }else{
        var numOfPK = game.pokers.length - game.currentIndex;
        userMgr.broacastInRoom('pk_count_push',numOfPK,turnSeat.userId,true);
    }

    //记录起牌动作
    //recordGameAction(game,game.turn,ACTION_QIPAI,pai);

    //通知前端新摸的牌
    userMgr.sendMsg(turnSeat.userId,'game_qipai_push',pai);

    //检查是否可以定主
    checkCanDingzhu(game,turnSeat,pai);

    //广播通知所有玩家当前起牌玩家正在起牌，等待
    userMgr.broacastInRoom('game_qipai_wait_push',turnSeat.userId,turnSeat.userId,true);

    

};
function qipai(game,seatIndex){
    if(game.currentIndex == game.pokers.length-6){  //如果还剩六张，则是底牌
        //保存底牌
        game.dipais = [];
        for(var i = game.currentIndex;i<game.pokers.length;++i){
            game.dipais.push(game.pokers[i]);
        }
        game.currentIndex = game.pokers.length;
        return -1;
    }
    var data = game.gameSeats[seatIndex];
    var pokers=data.holds;
    var pai = game.pokers[game.currentIndex];
    if(game.zhu != -1 && game.zhu == pkutils.getSuit(pai)){
        pai = pkutils.toZhupai(pai);
    }
    pokers.push(pai);
    game.currentIndex++;
    return pai;

};

function doQipaiFinish(game,userId){

    game.state = 'qipai_finished';
    userMgr.broacastInRoom('qipai_finished_push',userId,userId,true);

    if(game.button == -1){  //如果没有定庄
        console.log('game_rebegin');
        
        var roomId = roomMgr.getUserRoom(userId);
        if(roomId == null){
            return;
        }
        exports.begin(roomId);    //重新开始一局游戏
        return;
    }

    checkKeCanGeming(game);

    var fn = function(){    //判断是否进宫
        if(game.gong == 0){  //如果不进宫，
            //进入庄家起底牌阶段
            console.log('game_qidipai_push');
            setTimeout(doQidipai(game),1000);
        }else{
            //进入进宫阶段
            console.log('game_jingong_push');
            game.state = 'jingong';
            userMgr.broacastInRoom('game_jingong_push',game.gong,userId,true);
        }
    };
    if(game.zhu == -1){
        console.log('game_dingzhu_push');
        game.state = 'dingzhu';
        //通知所有客户端定主
        userMgr.broacastInRoom('game_dingzhu_push',userId,userId,true);
        setTimeout(function(){  //五秒后判断
            if(game.zhu == -1){ //如果还未定主
                //进入翻底牌定主阶段
                console.log('game_fandipai_dingzhu_push');
                game.state = 'fandipai';
                userMgr.broacastInRoom('game_fandipai_dingzhu_push',null,userId,true);
            }else{
                fn();
            }
        },5000);
    }else{
        fn();
    }

};
//判断客家是否可革命
function checkKeCanGeming(game){
    for(var i=0;i<game.gameSeats.length;++i){
        var seat = game.gameSeats[i];
        //获取客家手牌
        if(seat.seatIndex % 2 != game.zhu % 2){
            var holds = seat.holds;
            var score = pkutils.getTotalScoreOfHolds(holds);
            if(score == 0){
                seat.canGeming = true;
                userMgr.sendMsg(seat.userId,'can_geming_push',null);
            }
        }
    }
};

function checkZhuCanGeming(game){
    var seat = game.gameSeats[game.zhu];
    var holds = seat.holds;
    var score = pkutils.getTotalScoreOfHolds(holds);
    if(score >= 60){
        seat.canGeming = true;
        userMgr.sendMsg(seat.userId,'can_geming_push',null);
    }
}

exports.doDipaiDingzhu = function(userId,pkIndex){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }
    var seatIndex = seatData.seatIndex;
    var game = seatData.game;

    //翻起的底牌
    var fanpai = game.dipais[pkIndex];
    var zhu = pkutils.getSuit(fanpai);

    //进行定主操作
    exports.doDingzhu(userId,zhu);

    //通知所有玩家所翻底牌
    userMgr.broacastInRoom('fandipai_dingzhu_finished_push',{pkIndex:pkIndex,pkId:fanpai},userId,true);

    game.gong = 0;
    //1秒后进行庄家起底牌操作
    setTimeout(doQidipai(game),1000);
}

function initTurn(){
    var turn=Math.floor(Math.random()*4);
    return turn;
};

function checkCanDingzhu(game,turnSeat,pai){
    var suit = pkutils.getSuit(pai);
    var point = pkutils.getPoint(pai);
    if(point == 2){
        turnSeat.canDingzhus[suit] = true;
        userMgr.sendMsg(turnSeat.userId,'can_dingzhu_push',suit);
    }

}

function shuffle(game) {
    
    //四种花色并列顺序为：黑桃、红桃、黑梅、方块（数字从大到小）
    //204，203，202，201   ：五星，五反5
    //193，192，191，190   ：三反3
    //185，184，183        ：大王，小王，驴
    //173，172，171，170   ：J
    //163，162，161，160   ：2
    //74，73，70，69，68，67，66，65，64，63      ：黑桃A,K,10,9,8,7,6,5,4,3。
    //54，53，52，50，49，48，47，46，45，44，43  ：红桃A,K,Q，10，9，8,7,6,5,4,3,
    //34，33，32，30，29，28，27，26，25，24，23  ：黑梅A,K,Q，10，9，8,7,6,5,4,3,
    //14，13，12，10， 9， 8， 7， 6， 4， 3      ：方块A,K,Q，10，9，8,7,6,4,3，
    //2和J主花色加4，普通牌主花色加20，
    // game.pokers=[
    //     204,
    //     184,185,
    //     170,171,172,173,
    //     160,161,162,163,
    //     63,64,65,66,67,68,69,70,73,74,
    //     43,44,45,46,47,48,49,50,53,54,
    //     23,24,25,26,27,28,29,30,33,34,
    //     3, 4, 6, 7, 8, 9,10,13,14,
    //     183,52,32,12,
    // ];
    game.pokers=[
        3, 4, 6, 7, 8, 9,10,12,13,14,  
       23,24,25,26,27,28,29,30,32,33,34,
       43,44,45,46,47,48,49,50,52,53,54,
       63,64,65,66,67,68,69,70,73,74,
       160,161,162,163,
       170,171,172,173,
       183,184,185,
       204,    //五星

   ];
    

    var pokers=game.pokers;

    for(var i=0;i<pokers.length-1;++i){
        var lastIndex = pokers.length-1-i;
        var index = Math.floor(Math.random() * lastIndex);
        var t=pokers[index];
        pokers[index]=pokers[lastIndex];
        pokers[lastIndex]=t;
    }
};

exports.qipaiGuo = function(userId){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }

    var seatIndex = seatData.seatIndex;
    var game = seatData.game;
    var paishu = seatData.holds.length + seatData.sanfans.length + seatData.wufans.length;
    userMgr.broacastInRoom("game_paishu_notified_push",{seatIndex:seatIndex,paishu:paishu},userId,true);
    
    //下家摸牌
    moveToNextUser(game);
    doUserQipai(game);   
};

function moveToNextUser(game,nextSeat){
    if(nextSeat == null){
        game.turn ++;
        game.turn %= 4;
    }
    else{
        game.turn = nextSeat;
    }
};

exports.doDingzhu = function(userId,suit){
    var roomId = roomMgr.getUserRoom(userId);
    if(roomId == null){
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return;
    }
    var game = games[roomId];
    if(game == null){
        return;
    }

    if(game.zhu != -1){
        return;
    }

    //定主花色
    game.zhu = suit;

    
    var seats = game.gameSeats;
    for(var i = 0; i<seats.length; ++i){
        seats[i].canDingzhus = [false,false,false,false]; //将座位的可定主信息清空
        var holds = seats[i].holds;
        for(var j=0;j<holds.length;++j){
            if(pkutils.getSuit(holds[j]) == game.zhu){
                holds[j] = pkutils.toZhupai(holds[j]);  ////将玩家手牌进行主花色变更
            }
        }
        //通知客户端更新手牌
        userMgr.sendMsg(seats[i].userId,'game_holds_update_push',seats[i].holds);
    }

    //将扑克牌进行主花色变更
    for(var i = 0;i<game.pokers.length;++i){
        if(pkutils.getSuit(game.pokers[i]) == game.zhu){
            game.pokers[i] = pkutils.toZhupai(game.pokers[i]);
        }
    }

    //将底牌进行主花色变更
    for(var i=0;i<game.dipais.length;++i){
        if(pkutils.getSuit(game.dipais[i]) == game.zhu){
            game.dipais[i] = pkutils.toZhupai(game.dipais[i]);
        }
    }


    //通知所有玩家定主完成
    userMgr.broacastInRoom('game_dingzhu_notified_push',{userId:userId,zhu:suit},userId,true);
    //如果当前游戏没有定庄，第一局,则定主方就是新的庄家
    if(game.button == -1){
        var seatIndex = roomMgr.getUserSeat(userId);
        game.button = seatIndex;
        userMgr.broacastInRoom('game_zhuang_notified_push',seatIndex,userId,true);
    }
};

exports.doFan=function(userId,pkids){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }
    var seatIndex = seatData.seatIndex;
    var game = seatData.game;

    
    for(var i=0;i<pkids.length;++i){
        if(game.gongInfo.indexOf(pkids[i])!=-1){
            //进宫牌不能成反
            console.log("jingong pai can't be fan pai");
            return;
        }
        if(pkids[i]>185 && pkids[i]!=204){
            //已经是反不能再成反
            console.log("already fan pai");
            return;
        }
    }

    var fanPoint = pkutils.getPoint(pkids[0]);
    //记录三反、五反数据
    if(fanPoint == 3){
        seatData.sanfans = pkids;
    }else{
        seatData.wufans = pkids;
    }
    //更新玩家手牌
    for(var i=0;i<3;++i){
        var index = seatData.holds.indexOf(pkids[i]);
        if(index != -1){
            seatData.holds.splice(index,1);
        }
    }

    userMgr.sendMsg(userId,'game_holds_update_push',seatData.holds);   //通知玩家更新手牌

    //进行反牌变换
    if(seatData.sanfans && seatData.sanfans.length == 3){
        for(var i=0;i<3;++i){
            var pai = seatData.sanfans[i];
            seatData.sanfans[i]=pkutils.toFanpai(pai);
            var paiIndex = game.pokers.indexOf(pai);
            game.pokers[paiIndex] = seatData.sanfans[i];
        }
    }
    if(seatData.wufans && seatData.wufans.length == 3){
        for(var i=0;i<3;++i){
            var pai = seatData.wufans[i];
            seatData.wufans[i]=pkutils.toFanpai(pai);
            var paiIndex = game.pokers.indexOf(pai);
            game.pokers[paiIndex] = seatData.wufans[i];
        }
    }

    var ret = {
        userId:userId,
        sanfans:seatData.sanfans,
        wufans:seatData.wufans,
    };
    userMgr.broacastInRoom('game_fan_notified_push',ret,userId,true);

    if(game.gong > 0){  //如果存在进宫
        if(seatIndex % 2 != game.button % 2){   //如果是客家起反
            //则不需要进宫
            game.gong = 0;
            if(game.state == 'jingong'){    //如果是进宫状态
                //更新客户端进宫状态
                userMgr.broacastInRoom('game_jingong_push',game.gong,userId,true);
                //恢复玩家手牌
                for(var i=0;i<game.gongInfo.length;++i){
                    var pai = game.gongInfo[i];
                    if(pai == null){
                        continue;
                    }
                    var seat = game.gameSeats[i];
                    seat.holds.push(pai);
                    updateHoldsAndPaishu(seat); //更新恢复玩家手牌
                    delete game.gongInfo[i];
                }
                setTimeout(doQidipai(game),1000);   //进入庄家起底牌阶段
            }
        }
    }
};

function doQidipai(game){

    var zhuang = game.button;   //庄家
    if(zhuang == -1){
        return;
    }

    game.turn = zhuang; //由庄家执行动作
    var seatData = game.gameSeats[zhuang];
    //将底牌加给庄家手牌
    for(var i=0;i<game.dipais.length;++i){
        seatData.holds.push(game.dipais[i]);
    }
    game.dipais = [];   //清空底牌信息

    //更新客户端手牌和牌数信息
    updateHoldsAndPaishu(seatData);

    //检查庄家是否可革命
    checkZhuCanGeming(game);

    //进入扣底牌阶段
    game.state = 'koudipai';
    data = {
        button:game.turn,
        gamestate:game.state
    }
    //通知所有客户端进入扣底牌阶段
    userMgr.broacastInRoom("game_koudipai_notified_push",data,seatData.userId,true);
};

exports.doKoudipai = function(userId,koupais){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }
    var seatIndex = seatData.seatIndex;
    var game = seatData.game;

    //此处可以记录庄家扣底牌的动作历史
    // var action = {
    //     title:"koudipai",
    //     userId:userId,
    //     seatIndex:roomMgr.getUserSeat(userId),
    //     data:koupais,
    // }
    //recordActions(action);

    //服务器更新庄家手牌
    for(var i=0;i<koupais.length;++i){
        var index = seatData.holds.indexOf(koupais[i]);
        if(index != -1){
            seatData.holds.splice(index,1);
        }
    }

    //更新客户端手牌和牌数信息
    updateHoldsAndPaishu(seatData);

    //通知所有玩家庄家所扣底牌，扣底牌结束
    var ret = {
        button:seatIndex,
        koupais:koupais
    };
    userMgr.broacastInRoom('game_koudipai_finished_push',ret,userId,true);

    //通知所有玩家进入出牌阶段
    game.state = 'chupai';
    game.curLunInfo = {
        firstTurn:game.turn,    //本轮首位出牌玩家
        curTurn:game.turn,  //当前出牌玩家
        curWinTurn:-1,  //本轮当前赢牌玩家
        turnInfo:[],    //本轮已出牌信息
    }
    userMgr.broacastInRoom('game_chupai_push',userId,userId,true);
};

function updateHoldsAndPaishu(seatData){
    console.log(seatData.holds);

    var userId = seatData.userId;

    //通知玩家客户端更新手牌
    userMgr.sendMsg(userId,'game_holds_update_push',seatData.holds);
    
    //更新玩家三五反信息
    var ret = {
        userId:userId,
        sanfans:seatData.sanfans,
        wufans:seatData.wufans,
    };
    userMgr.broacastInRoom('game_fan_notified_push',ret,userId,true);
    //通知所有玩家更新手牌数信息
    var paishu = seatData.holds.length + seatData.sanfans.length + seatData.wufans.length;
    console.log(paishu);
    var data = {
        seatIndex:seatData.seatIndex,
        paishu:paishu
    };
    userMgr.broacastInRoom("game_paishu_notified_push",data,userId,true);
};

//玩家出牌
exports.doChupai = function(userId,chupais){
    console.log('doChupai');
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user's seat data");
        return;
    }
    var game = seatData.game;
    var seatIndex = seatData.seatIndex;

    if(game.turn != seatIndex){
        console.log("not your turn");
        return;
    }

    if(game.curLunInfo == null){
        game.curLunInfo = {
            firstTurn:game.turn,    //本轮首位出牌玩家
            curTurn:game.turn,  //当前出牌玩家
            curWinTurn:-1,  //本轮当前赢牌玩家
            turnInfo:[],    //本轮已出牌信息
        }
    }

    if(checkChupaiObj(game,seatData,chupais)){  //检测出牌是否有效，如果有效，进行相应操作

        //通知所有玩家用户出牌
        var ret = {
            userId:userId,
            chupais:chupais,
        };
        userMgr.broacastInRoom('game_chupai_notified_push',ret,userId,true);

        //将出牌从玩家手牌中扣除
        splicePaisFromHolds(seatData,chupais);
        //更新玩家手牌和牌数
        updateHoldsAndPaishu(seatData);
        
        //检查本轮是否结束，未结束由下一个玩家出牌，结束则更新比分，由下一个赢家出牌
        checkCurLunFinished(game);
    }
};

//将出牌从玩家手牌中扣除
function splicePaisFromHolds(seatData,pais){
    console.log("splicePaisFromHolds");
    console.log("holds:"+holds);
    console.log("pais:"+pais);
    if(pais == null){
        return;
    }
    var holds = seatData.holds;
    var sanfans = seatData.sanfans;
    var wufans = seatData.wufans;
    for(var i = 0;i<pais.length;++i){
        //手牌
        var index = holds.indexOf(pais[i]);
        if(index != -1){
            holds.splice(index,1);
            continue;
        }
        //三反
        index = sanfans.indexOf(pais[i]);
        if(index!= -1){
            sanfans.splice(index,1);
        }
        //五反
        index = wufans.indexOf(pais[i]);
        if(index!= -1){
            wufans.splice(index,1);
        }
    }
    console.log("after holds:"+holds);
}

function checkChupaiObj(game,seatData,chupais){
    if(chupais == null || chupais.length<=0 || chupais.length>12){
        return false;
    }

    if(checkDanObj(game,seatData,chupais)){ //如果当前出单牌有效
        return true;
    }
    if(checkGangObj(game,seatData,chupais)){    //如果当前出杠牌有效
        return true;
    }
    if(checkShunObj(game,seatData,chupais)){    //如果当前出顺牌有效
        return true;
    }

    return false;
};

//检查是否是单牌
function checkDanObj(game,seatData,chupais){
    var createObj = function(pais){
        var chupaisObj = {};
        var pai = pais[0];
        chupaisObj.type = "danpai";
        chupaisObj.chupais = pais;
        chupaisObj.suit = pai>80?game.zhu:pkutils.getSuit(pai);
        chupaisObj.paishu = 1;
        chupaisObj.seatIndex = seatData.seatIndex;
        chupaisObj.userId = seatData.userId;
        return chupaisObj;
    };

    var curLunInfo = game.curLunInfo;
    var chupaisObj = null;
    if(curLunInfo.curWinTurn == -1){    //如果是本轮首位
        if(chupais.length == 1){    //如果是单牌
            var chupaisObj = createObj(chupais);
            curLunInfo.turnInfo[seatData.seatIndex] = chupaisObj;
            curLunInfo.curWinTurn = seatData.seatIndex;
            return true;
        }else{
            return false;   //如果所出牌不是单牌，出牌无效
        }
    }else{  //如果不是本轮首位
        var firstTurnInfo = curLunInfo.turnInfo[curLunInfo.firstTurn];
        if(firstTurnInfo.type == "danpai" && chupais.length == 1){ //如果本轮走的是单牌,而且出牌也是单牌
            var pai = chupais[0];
            var paiSuit = pai>80?game.zhu:pkutils.getSuit(pai);
            console.log("zhu: "+ game.zhu);
            console.log("first suit: "+firstTurnInfo.suit);
            console.log("cur suit: "+paiSuit);
            var holds = pkutils.getTotalHolds(seatData);    //获取用户总手牌
            if(pkutils.containSuit(holds,firstTurnInfo.suit,game.zhu) && paiSuit != firstTurnInfo.suit){
                console.log("contain suit, but chupai suit wrong");
                return false;   //如果手牌中含有本轮所叫花色，而出牌的不是该花色，出牌无效
            }
            console.log("valid chupai");
            //出牌有效
            var chupaisObj = createObj(chupais);
            curLunInfo.turnInfo[seatData.seatIndex] = chupaisObj;

            //与当前赢家出牌比较
            var curWinTurnInfo = curLunInfo.turnInfo[curLunInfo.curWinTurn];
            if(curWinTurnInfo.suit == paiSuit){ //如果花色相同
                var curWinPai = curWinTurnInfo.chupais[0];
                if(curWinPai < pai){    //比较牌的点数大小，大于以往赢家，赢
                    var paiPoint = pkutils.getPoint(pai);
                    var curWinPaiPoint = pkutils.getPoint(curWinPai);
                    if(paiPoint == curWinPaiPoint){ //如果扑克点数相同
                        if(paiPoint == 5 && pai != 204){return true;}//五反
                        if(paiPoint == 3){return true;}//三反
                        if(pkutils.getSuit(pai)!=game.zhu){return true;} //2或J，判断是不是主主牌
                    }
                    curLunInfo.curWinTurn = seatData.seatIndex;
                }
            }else{  //如果花色不同
                if(paiSuit == game.zhu){    //如果所出牌是主牌，则以往赢家是副牌，赢
                    curLunInfo.curWinTurn = seatData.seatIndex;
                }
            }
            return true;
        }else{
            return false;   //如果本轮叫的不是单牌，或所出牌不是单牌，出牌无效
        }
    }
    return false;
};

//检查是否是顺牌
function checkShunObj(game,seatData,chupais){
    console.log("check shun obj");
    //顺牌Obj
    var createObj = function(pais,suit){
        var chupaisObj = {};
        chupaisObj.type = "shunpai";
        chupaisObj.chupais = pais;
        chupaisObj.suit = suit;
        chupaisObj.paishu = pais.length;
        chupaisObj.seatIndex = seatData.seatIndex;
        chupaisObj.userId = seatData.userId;
        return chupaisObj;
    };

    //单牌Obj
    var createDanObj = function(pais){
        var chupaisObj = {};
        var pai = pais[0];
        chupaisObj.type = "danpai";
        chupaisObj.chupais = pais;
        chupaisObj.suit = pai>80?game.zhu:pkutils.getSuit(pai);
        chupaisObj.paishu = 1;
        chupaisObj.seatIndex = seatData.seatIndex;
        chupaisObj.userId = seatData.userId;
        return chupaisObj;
    };


    var curLunInfo = game.curLunInfo;
    var chupaisObj = null;



    if(curLunInfo.curWinTurn == -1){    //如果是本轮首位
        if(chupais.length <2){  //如果出牌数小于2，则不是顺牌
            return false;
        }
        var sameSuit = pkutils.checkSameSuit(chupais,game.zhu); //检查当前出牌是否是同一花色
        console.log("same suit: "+sameSuit);
        if(sameSuit == -1){ //如果不是同一花色，不是顺牌
            return false;
        }
        //与当前所有玩家的手牌相比较，判断出牌是否为最大顺牌
        if(checkCanShunPais(game,seatData.seatIndex,chupais,sameSuit)){   
            console.log("can shun pai");
            //如果是最大顺牌
            var chupaisObj = createObj(chupais,sameSuit);
            curLunInfo.turnInfo[seatData.seatIndex] = chupaisObj;
            curLunInfo.curWinTurn = seatData.seatIndex;
            return true;
            
        }else{
            console.log("can't be shun pai");
            //否则自动出最小单牌
            var minChupai = pkutils.getMinPai(chupais,sameSuit,game.zhu); //获得出牌的最小点数
            chupais.splice(0,chupais.length);
            chupais.push(minChupai);
            var chupaisObj = createDanObj(chupais);
            curLunInfo.turnInfo[seatData.seatIndex] = chupaisObj;
            curLunInfo.curWinTurn = seatData.seatIndex;
            return true;
        }
    }else{  //如果不是本轮首位
        var firstTurnInfo = curLunInfo.turnInfo[curLunInfo.firstTurn];
        if(firstTurnInfo.type == "shunpai" && chupais.length == firstTurnInfo.paishu){
            //如果叫的是顺牌，而且出牌数符合叫牌数
            var holds = pkutils.getTotalHolds(seatData);    //获取玩家总手牌
            var holdsSuitCnt = pkutils.getSuitCountOfHolds(holds,firstTurnInfo.suit,game.zhu);
            var chupaisSuitCnt = pkutils.getSuitCountOfHolds(chupais,firstTurnInfo.suit,game.zhu);

            if(chupaisSuitCnt < Math.min(firstTurnInfo.paishu,holdsSuitCnt)){
                //当前玩家出牌中所叫花色的牌数如果小于手牌中的所叫花色数目和叫牌数目的较小者，
                //则说明手牌中还有所叫花色可出但未出，违反游戏规则，返回false，出牌无效。
                return false;
            }

            //如果出牌符合所叫顺牌规则
            var sameSuit = pkutils.checkSameSuit(chupais,game.zhu); //检查当前出牌是否是同一花色
            var chupaisObj = createObj(chupais,sameSuit);
            curLunInfo.turnInfo[seatData.seatIndex] = chupaisObj;            

            //与当前赢家出牌比较
            var curWinTurnInfo = curLunInfo.turnInfo[curLunInfo.curWinTurn];
            if(sameSuit == game.zhu){   //如果玩家出牌是主本牌
                if(curWinTurnInfo.suit != game.zhu){    //如果以往赢家不是主本牌，赢
                    curLunInfo.curWinTurn = seatData.seatIndex;
                }else{  //如果以往赢家也是主本牌
                    var pai = pkutils.getMaxPai(chupais);   //获取当前玩家主本牌最大点数
                    var curWinPai = pkutils.getMaxPai(curWinTurnInfo.chupais);    //获取以往赢家主本牌最大点数
                    if(pai > curWinPai){  //如果当前玩家最大主本牌大于以往赢家，赢
                        var paiPoint = pkutils.getPoint(pai);
                        var curWinPaiPoint = pkutils.getPoint(curWinPai);
                        if(paiPoint == curWinPaiPoint){ //如果扑克点数相同
                            if(paiPoint == 5 && pai != 204){return true;}//五反
                            if(paiPoint == 3){return true;}//三反
                            if(pkutils.getSuit(pai)!=game.zhu){return true;} //2或J，判断是不是主主牌
                        }
                        curLunInfo.curWinTurn = seatData.seatIndex;
                    }
                }
            }
            return true;
        }else{
            return false;   //如果本轮叫的不是顺牌，或所出牌不是顺牌，出牌无效
        }
    }
    return false;
};

//检查是否是杠牌
function checkGangObj(game,seatData,chupais){
    //如果当前出牌不是4张，则不可能是杠牌
    if(!chupais || chupais.length != 4){
        return false;
    }

    //如果是4张

    console.log("check gang obj");
    var createObj = function(pais,point,gangType){
        var chupaisObj = {};
        chupaisObj.type = "gangpai";
        chupaisObj.gangType = gangType; //-1混牌，0假杠，1真杠
        chupaisObj.chupais = pais;
        chupaisObj.point = point;   //杠牌点数
        chupaisObj.paishu = pais.length;
        chupaisObj.seatIndex = seatData.seatIndex;
        chupaisObj.userId = seatData.userId;
        return chupaisObj;
    };

    var curLunInfo = game.curLunInfo;
    var chupaisObj = null;
    if(curLunInfo.curWinTurn == -1){    //如果当前是新的一轮
        //判断牌中是否存在反牌，反牌不能成杠
        for(var i=0;i<chupais.length;++i){
            if(chupais[i]>185 && chupais[i]<204){
                //点数大于大王，小于五星的是反牌
                return false;
            }
        }

        //进宫牌不能成杠
        for(var i=0;i<chupais.length;++i){
            if(game.gongInfo.indexOf(chupais[i])!=-1){
                console.log("jingong pai can't be fan pai");
                return false;
            }
        }

        var lvIndex = chupais.indexOf(183); //判断是否包含驴
        if(lvIndex == -1){  //如果不包含驴，则判断是否可能是真杠
            console.log("test zhengang");
            var samePoint = pkutils.checkSamePoint(chupais); //检查四张牌是否是真杠
            if(samePoint>0){ //如果是真杠
                
                var chupaisObj = createObj(chupais,samePoint,1);    //1真杠
                curLunInfo.turnInfo[seatData.seatIndex] = chupaisObj;
                curLunInfo.curWinTurn = seatData.seatIndex;
                return true;
            }else{
                return false;
            }
        }else{  //如果包含驴，判断是否为假杠
            console.log("test jiagang");
            chupais.splice(lvIndex,1);    //删除驴牌
            var samePoint = pkutils.checkSamePoint(chupais);    //剩下三张判断是否点数相同
            console.log("same point: "+samePoint);
            if(samePoint < 0){    //如果剩下三张点数不同，则不能是假杠
                return false;
            }
            if(samePoint == 12){    //如果剩下三张也是Q
                //通知前端选择出Q假杠还是出Q真杠
                userMgr.sendMsg(seatData.userId,'choice_qgang_push',null);
                return false;
            }
            chupais.push(183);  //加回驴牌
            console.log("valid jia gang");
            //出牌有效，为假杠
            var chupaisObj = createObj(chupais,samePoint,0);    //0假杠
            curLunInfo.turnInfo[seatData.seatIndex] = chupaisObj;
            curLunInfo.curWinTurn = seatData.seatIndex;
            return true;
        }
    }else{  //如果当前不是本轮首位,因为只有一个驴，则只有可能出的是真杠，
        var firstTurnInfo = curLunInfo.turnInfo[curLunInfo.firstTurn];
        if(firstTurnInfo.type != "gangpai" || chupais.length != 4){
            //如果叫牌不是杠牌或者出牌不是4张，则杠牌无效
            return false;
        }



        //叫牌是杠牌而且出牌4张
        var samePoint = pkutils.checkSamePoint(chupais); //检查四张牌是否是真杠
        if(samePoint>0){ //如果是真杠
            //判断牌中是否存在反牌，反牌不能成杠
            for(var i=0;i<chupais.length;++i){
                if(chupais[i]>185 && chupais[i]<204){
                    //点数大于大王，小于五星的是反牌
                    return false;
                }
            }

            //进宫牌不能成杠
            for(var i=0;i<chupais.length;++i){
                if(game.gongInfo.indexOf(chupais[i])!=-1){
                    console.log("jingong pai can't be fan pai");
                    return false;
                }
            }


            var chupaisObj = createObj(chupais,samePoint,1);
            curLunInfo.turnInfo[seatData.seatIndex] = chupaisObj;
            //与当前赢家出牌比较
            var curWinTurnInfo = curLunInfo.turnInfo[curLunInfo.curWinTurn];
            if(curWinTurnInfo.gangType < 1 || curWinTurnInfo.point<samePoint){
                //如果以往赢家不是真杠牌或者真杠点数小于当前出牌玩家真杠点数，赢
                curLunInfo.curWinTurn = seatData.seatIndex;
            }
            return true;
        }else{  //如果不是真杠,则是普通牌
            var holds = pkutils.getTotalHolds(seatData);
            var holdsZhuCnt = pkutils.getZhuCountOfHolds(holds,game.zhu);
            var chupaisZhuCnt = pkutils.getZhuCountOfHolds(chupais,game.zhu);
            if(firstTurnInfo.gangType == 0){    //如果叫牌是假杠牌，需出副牌
                if((chupais.length-chupaisZhuCnt)<Math.min(4,holds.length-holdsZhuCnt)){
                    //当前玩家出牌中的副牌数如果小于手牌中的副牌数目和叫牌数目的较小者，
                    //则说明手牌中还有副牌可出但未出，违反游戏规则，返回false，出牌无效。
                    return false;
                }
            }else{  //如果叫牌是真杠牌，需出主牌
                if(chupaisZhuCnt<Math.min(4,holdsZhuCnt)){
                    //当前玩家出牌中的主牌数如果小于手牌中的主牌数目和叫牌数目的较小者，
                    //则说明手牌中还有主牌可出但未出，违反游戏规则，返回false，出牌无效。
                    return false;
                }
            }
            //出牌有效
            var chupaisObj = createObj(chupais,samePoint,-1);
            curLunInfo.turnInfo[seatData.seatIndex] = chupaisObj;
            return true;
        }
    }
    return false;
};

//检查出牌是否是顺牌
function checkCanShunPais(game,seatIndex,chupais,chupaisSuit){
    var seats = game.gameSeats;
    var zhu = game.zhu;
    var minChupai = pkutils.getMinPai(chupais,chupaisSuit,zhu); //获得出牌的最小点数
    for(var i=0;i<seats.length;++i){

        var holds = pkutils.getTotalHolds(seats[i]);

        if(i == seatIndex){ //如果是出牌玩家自己的手牌
            holds = pkutils.splicePais(holds,chupais);  //创建手牌副本，删除出牌部分
        }
        
        //判断所有玩家的手牌，对于特定出牌花色，出牌的最小点数是否是所有玩家当前手牌的最大点数
        for(var j=0;j<holds.length;++j){
            var holdSuit = holds[j]>80?zhu:pkutils.getSuit(holds[j]);
            if(holdSuit == chupaisSuit){

                if(holds[j]>minChupai){ //如果有玩家手牌点数大于同花色出牌最小点数
                    var holdPoint = pkutils.getPoint(holds[j]);
                    var minChupaiPoint = pkutils.getPoint(minChupai);
                    if(holdPoint == minChupaiPoint){ //如果扑克点数相同,两张都是主
                        if(holdPoint == 5 && holdPoint != 204){continue;}//五反非五星，不大
                        if(holdPoint == 3){continue;}//三反，不大
                        if(pkutils.getSuit(holdPoint)!=game.zhu){continue;} //2或J，不是主主牌，不大
                    }
                    console.log('can\'t shun pai');
                    return false;   //则出牌不是顺牌，返回false
                }
            }
        }
    }
    return true;
}

//检查本轮是否结束，未结束由下一个玩家出牌，结束则更新比分，由下一个赢家出牌
function checkCurLunFinished(game){
    console.log("check cur lun finished");
    var curLunInfo = game.curLunInfo;
    console.log("current turn: "+game.turn);
    moveToNextUser(game);
    console.log("move to next turn: "+game.turn);
    console.log("first turn: "+curLunInfo.firstTurn);
    if(game.turn == curLunInfo.firstTurn){  //如果本轮结束
        moveToNextUser(game,curLunInfo.curWinTurn); //移到赢家开始下一轮
        //统计本轮赢家得分，并将得分加到相应队伍，相应玩家座位手中。
        caculateScore(game);
        //重新初始化本轮信息对象
        game.curLunInfo.firstTurn = game.turn;//本轮首位出牌玩家
        game.curLunInfo.curTurn = game.turn;//当前出牌玩家
        game.curLunInfo.curWinTurn = -1;//本轮当前赢牌玩家
        game.curLunInfo.turnInfo = [];//本轮已出牌信息
    }else{
        curLunInfo.curTurn = game.turn;
    }

    var turnSeat = game.gameSeats[game.turn];
    //更新轮次信息
    userMgr.broacastInRoom('game_luninfo_push',game.curLunInfo,turnSeat.userId,true);
    if(game.curLunInfo.curWinTurn == -1){   //如果重新开始一轮
        //如果新一轮出牌的首位玩家的手牌数为空，则表示本局比赛结束
        var totalHolds = turnSeat.holds.length + turnSeat.sanfans.length + turnSeat.wufans.length;
        if(totalHolds == 0){    //表示本局游戏结束
            exports.rebegin(game);  //游戏重新开始
            return;

        }
        //特定时间后
        setTimeout(function(){
            //通知玩家出牌
            userMgr.broacastInRoom('game_chupai_push',turnSeat.userId,turnSeat.userId,true);
        },1000);
    }else{
        //通知玩家出牌
        userMgr.broacastInRoom('game_chupai_push',turnSeat.userId,turnSeat.userId,true);
    }

};

function caculateScore(game){

    var score = 0;
    var turnInfo = game.curLunInfo.turnInfo;
    for(var i in turnInfo){
        if(turnInfo[i] != null){
            var chupais = turnInfo[i].chupais;
            for(var i=0;i<chupais.length;++i){
                var point = pkutils.getPoint(chupais[i]);
                if(point == 5){ //5分
                    score += 5;
                }else if(point == 10 || point == 13){
                    score +=10; //10分
                }
            }
        }
    }

    //赢家座位数据
    var winSeatData = game.gameSeats[game.curLunInfo.curWinTurn];
    //赢家所属队伍
    var winTeam = winSeatData.seatIndex % 2;

    if(winSeatData.score == null){
        winSeatData.score = 0;
    }
    winSeatData.score += score; //更新赢家得分
    if(game.teamVS == null){
        game.teamVS = [0,0];
    }
    //记录两队得分
    game.teamVS[winTeam] += score;
    //通知所有玩家更新比分
    userMgr.broacastInRoom('team_score_push',game.teamVS,winSeatData.userId,true);

};

exports.doQgang = function(userId,choice){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log('seatData null');
        return;
    }
    var game = seatData.game;
    var seatIndex = seatData.seatIndex;

    if(game.turn != seatIndex){
        console.log("not your turn");
        return;
    }

    if(game.curLunInfo == null){
        game.curLunInfo = {
            firstTurn:game.turn,    //本轮首位出牌玩家
            curTurn:game.turn,  //当前出牌玩家
            curWinTurn:-1,  //本轮当前赢牌玩家
            turnInfo:[],    //本轮已出牌信息
        }
    }

    if(game.curLunInfo.curWinTurn != -1){
        return; //如果不是本轮首位出牌玩家，不可能进行Q杠的真假杠选择
    }

    var createObj = function(pais,point,gangType){
        var chupaisObj = {};
        chupaisObj.type = "gangpai";
        chupaisObj.gangType = gangType; //-1混牌，0假杠，1真杠
        chupaisObj.chupais = pais;
        chupaisObj.point = point;   //杠牌点数
        chupaisObj.paishu = pais.length;
        chupaisObj.seatIndex = seatData.seatIndex;
        chupaisObj.userId = seatData.userId;
        return chupaisObj;
    };
    
    var chupais = [183,52,32,12];   //  黑桃、红桃、黑梅、方块Q

    for(var i=1;i<chupais.length;++i){
        if(pkutils.getSuit(chupais[i]) == game.zhu){
            chupais[i] += 80;break;
        }
    }

    var curLunInfo = game.curLunInfo;
    var chupaisObj = createObj(chupais,12,choice);

    curLunInfo.turnInfo[seatData.seatIndex] = chupaisObj;
    curLunInfo.curWinTurn = seatData.seatIndex;


    //通知所有玩家用户出牌
    var ret = {
        userId:userId,
        chupais:chupais,
    };
    userMgr.broacastInRoom('game_chupai_notified_push',ret,userId,true);

    //将出牌从玩家手牌中扣除
    splicePaisFromHolds(seatData,chupais);
    //更新玩家手牌和牌数
    updateHoldsAndPaishu(seatData);
    
    //检查本轮是否结束，未结束由下一个玩家出牌，结束则更新比分，由下一个赢家出牌
    checkCurLunFinished(game);
};

exports.hasBegan = function(roomId){
    var game = games[roomId];
    if(game != null){
        return true;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo != null){
        return roomInfo.numOfGames > 0;
    }
    return false;
};

//进宫
exports.doJingong = function(userId,pkId){

    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }
    var seatIndex = seatData.seatIndex;
    var game = seatData.game;
    if(game.gong == 0){
        return;
    }

    //判断玩家是否需要进宫或退宫
    if(game.gong == 1){
        if(seatIndex != game.button && seatIndex != (game.button + 3) % 4){
            console.log("you needn't jingong");
            return;
        }
    }
    //判断进宫牌是否有效
    var point = pkutils.getPoint(pkId);
    var suit = pkId>80?game.zhu:pkutils.getSuit(pkId);
    if(seatIndex % 2 == game.button % 2){   //如果是退宫方
        if(point == 5 && pkId != 204 || point == 10 || point == 13){
            console.log("can't tuigong fenpai");
            return;
        }
        if(pkId > 185){
            console.log("can't tuigong fanpai or wuxing");
            return;
        }
        var holdsZhuCnt = 0;
        var holds = seatData.holds;
        for(var i=0;i<holds.length;++i){
            var pai = holds[i];
            var point1 = pkutils.getPoint(pai);
            if(point1 == 5 && pai != 204 || point1 == 10 || point1 == 13){
                continue;   //如果是非五星分牌，跳过
            }
            if(pai > 80){
                holdsZhuCnt++;  //非分主牌计数
            }
        }
        if(holdsZhuCnt > 0 && suit != game.zhu){
            console.log("can't tuigong fu when you have zhu");
            return;
        }
    }else{  //如果是进宫方
        //获取最大非分牌牌（包括五星）
        var maxPai = -1;
        var holds = seatData.holds;
        for(var i=0;i<holds.length;++i){
            var pai = holds[i];
            var point1 = pkutils.getPoint(pai);
            if(point1 == 5 && pai != 204 || point1 == 10 || point1 == 13){
                continue;   //如果是非五星分牌，跳过
            }
            if(pai > maxPai){
                maxPai = pai;
            }
        }

        if(maxPai != pkId){ //如果进宫牌不是最大非分牌（包括五星）
            console.log("this's not your max feifen pai");
            return;
        }
    }

    //如果进宫或退宫牌有效
    if(game.gongInfo == null){
        game.gongInfo = [];
    }
    var gongInfo = game.gongInfo;
    gongInfo[seatIndex] = pkId; //记录进宫牌
    var holds = seatData.holds;
    var pkIndex = holds.indexOf(pkId);
    if(pkIndex!=-1){    
        holds.splice(pkIndex,1);    //删除进宫牌
        updateHoldsAndPaishu(seatData); //更新客户端手牌
        userMgr.sendMsg(userId,'jingong_succeed_push',null);
    }
    if(game.gong == 1){ //如果是单进
        var zhuang = game.button;
        if(gongInfo[zhuang] != null && gongInfo[(zhuang+3)%4] != null){
            //如果退进宫均已完成，交换手牌
            game.gameSeats[zhuang].holds.push(gongInfo[(zhuang+3)%4]);
            updateHoldsAndPaishu(game.gameSeats[zhuang]); //更新客户端手牌
            game.gameSeats[(zhuang+3)%4].holds.push(gongInfo[zhuang]);
            updateHoldsAndPaishu(game.gameSeats[(zhuang+3)%4]); //更新客户端手牌

            //清除进宫信息
            game.gong = 0;  
            //进入庄家起底牌阶段
            console.log('game_qidipai_push');
            setTimeout(doQidipai(game),1000);
        }
    }else{  //如果是双进
        var zhuang = game.button;
        if(gongInfo[zhuang] != null && gongInfo[(zhuang+1)%4] != null &&
            gongInfo[(zhuang+2)%4] != null && gongInfo[(zhuang+3)%4] != null){

            //如果退进宫均已完成，交换手牌
            game.gameSeats[zhuang].holds.push(gongInfo[(zhuang+3)%4]);
            updateHoldsAndPaishu(game.gameSeats[zhuang]); //更新客户端手牌
            game.gameSeats[(zhuang+3)%4].holds.push(gongInfo[zhuang]);
            updateHoldsAndPaishu(game.gameSeats[(zhuang+3)%4]); //更新客户端手牌

            game.gameSeats[(zhuang+1)%4].holds.push(gongInfo[(zhuang+2)%4]);
            updateHoldsAndPaishu(game.gameSeats[(zhuang+1)%4]); //更新客户端手牌
            game.gameSeats[(zhuang+2)%4].holds.push(gongInfo[(zhuang+1)%4]);
            updateHoldsAndPaishu(game.gameSeats[(zhuang+2)%4]); //更新客户端手牌     
            
            //清除进宫信息
            game.gong = 0;  
            //进入庄家起底牌阶段
            console.log('game_qidipai_push');
            setTimeout(doQidipai(game),1000);
        }
    }

};

//革命
exports.doGeming = function(userId){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }
    var seatIndex = seatData.seatIndex;
    var game = seatData.game;

    //获取房间信息
    var roomInfo = game.roomInfo;

    roomInfo.nextButton = -1;
    roomInfo.nextTurn = game.button;
    roomInfo.nextGong = 0; 

    userMgr.broacastInRoom("geming_notified_push",{userId:userId},userId,true);
    setTimeout(exports.begin(roomInfo.id),1000);
    
}

//游戏重新开始新的一局
exports.rebegin = function(game){
    //获得客家队伍
    var teamKe = 1 -  game.button % 2;
    //获得客家队伍得分
    var keScore = game.teamVS[teamKe];
    //获取房间信息
    var roomInfo = game.roomInfo;
    if(keScore<40){ //如果客家得分小于40，没有下台，
        roomInfo.nextButton = game.button;
        roomInfo.nextTurn = game.button;
        roomInfo.nextGong = keScore==0?2:0; //如果客家得分为0，则是双进
        //庄家队加分
        roomInfo.seats[game.button].score += roomInfo.nextGong+1;
        roomInfo.seats[(game.button+2)%4].score += roomInfo.nextGong+1;
    }else{
        roomInfo.nextButton = (game.button+1)%4;    //下一位是庄家
        roomInfo.nextTurn = roomInfo.nextButton;
        roomInfo.nextGong = keScore<60?0:(keScore<80?1:2);  //如果客家得分超80，则是双进
        
        //客家队加分
        roomInfo.seats[(game.button+1)%4].score += roomInfo.nextGong+1;
        roomInfo.seats[(game.button+3)%4].score += roomInfo.nextGong+1;
    }
    setTimeout(function(){
        exports.begin(roomInfo.id)
    },1000);
};

var dissolvingList = [];
//解散房间申请
exports.dissolveRequest = function(roomId,userId){
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return null;
    }

    if(roomInfo.dr != null){
        return null;
    }

    var seatIndex = roomMgr.getUserSeat(userId);
    if(seatIndex == null){
        return null;
    }

    roomInfo.dr = {
        endTime:Date.now() + 30000,
        states:[false,false,false,false]
    };
    roomInfo.dr.states[seatIndex] = true;

    dissolvingList.push(roomId);

    return roomInfo;
};

exports.dissolveAgree = function(roomId,userId,agree){
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return null;
    }

    if(roomInfo.dr == null){
        return null;
    }

    var seatIndex = roomMgr.getUserSeat(userId);
    if(seatIndex == null){
        return null;
    }

    if(agree){
        roomInfo.dr.states[seatIndex] = true;
    }
    else{
        roomInfo.dr = null;
        var idx = dissolvingList.indexOf(roomId);
        if(idx != -1){
            dissolvingList.splice(idx,1);           
        }
    }
    return roomInfo;
};

exports.doDissolve = function(roomId){
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return null;
    }

    var game = games[roomId];
    doGameOver(game,roomInfo.seats[0].userId,true);
};



function doGameOver(game,userId,forceEnd){
    var roomId = roomMgr.getUserRoom(userId);
    if(roomId == null){
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return;
    }

    var fnNoticeResult = function(isEnd){

        userMgr.broacastInRoom('game_over_push',null,userId,true);
        //如果局数已够，则进行整体结算，并关闭房间
        if(isEnd){
            userMgr.kickAllInRoom(roomId);
            roomMgr.destroy(roomId);
        }
    }

    if(game != null){
        for(var i = 0; i < roomInfo.seats.length; ++i){
            var rs = roomInfo.seats[i];
            var sd = game.gameSeats[i];
            rs.ready = false;
            rs.score += sd.score;

            //更新数据库玩家经验信息
            db.update_user_exp(rs.userId,rs.score);
            
            delete gameSeatsOfUsers[rs.userId]; //删除gameSeatsOfUsers
        }
        delete games[roomId];   //删除games[roomId]
    }
    
    if(forceEnd || game == null){
        fnNoticeResult(true);   
    }
}
