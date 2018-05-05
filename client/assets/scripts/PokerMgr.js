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
cc.Class({
    extends: cc.Component,

    properties: {
       // resources
       redTextColor: cc.Color.WHITE,
       blackTextColor: cc.Color.WHITE,
       texFrontBG: cc.SpriteFrame,
       texBackBG: cc.SpriteFrame,
       texFaces: {
           default: [],
           type: cc.SpriteFrame
       },
       texSuitBig: {
           default: [],
           type: cc.SpriteFrame
       },
       texSuitSmall: {
           default: [],
           type: cc.SpriteFrame
       },
       jokerSuitBig:{
           default: [],
           type:cc.SpriteFrame
       },
       jokerSuitSmall:{
           default: [],
           type:cc.SpriteFrame
       },
        cardPrefab:{
            default:null,
            type:cc.Prefab
        },
        points:[],
       
    },

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        cc.vv.pokermgr=this;
        this.points=['','','2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    },

    start () {

    },

    // update (dt) {},

    setHoldEmpty:function(card){
        card.point.node.active=false;
        card.suit.node.active=false;
        card.mainPic.node.active=false;
        card.joker_suit.node.active=false;
        card.node.getComponent(cc.Sprite).spriteFrame=this.texBackBG;
    },

    sortPK:function(pokers){
        var self = this;
        pokers.sort(function(a,b){
            return b-a;
        });
    },

    //判断是否是主
    isZhu:function(poker){
        if(poker<160){
            var suitIndex=Math.floor(poker/20);
            return suitIndex>3;
        }else{
            return true;
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
        }else if(poker==183){   //黑桃Q
            return 3;
        }else if(poker==184 || poker==185){ //大小王
            return poker-184+4;
        }else if(poker>=190 && poker<194){  //三反3
            return (poker-190)%4;
        }else if(poker>200 && poker<=204){  //五星，五反5
            return (poker-200)%4;
        }else{
            return -1;
        }
    },

    //得到点数
    getPoint:function(poker){
        if(poker<160){
            return poker%20;   //普通牌point=(pkid%20)
        }else if(poker<170){
            return 2;
        }else if(poker<180){
            return 11;
        }else if(poker==183){   //黑桃Q
            return 12;
        }else if(poker==184 || poker==185){ //大小王
            return poker-184+15;
        }else if(poker>=190 && poker<194){  //三反3
            return 3;
        }else if(poker>200 && poker<=204){  //五星，五反5
            return 5;
        }else{
            return -1;
        }
    },

    setCardByPKID:function(card,pkid){
        if(pkid<0 || pkid>204){
            return;
        }
        card.cardBG.spriteFrame=this.texFrontBG;
        if(pkid == 184 || pkid == 185){
            var index=pkid-184;
            card.point.node.active=false;
            card.suit.node.active=false;
            card.joker_suit.node.active=true;
            card.joker_suit.spriteFrame=this.jokerSuitSmall[index];
            card.mainPic.node.active=true;
            card.mainPic.spriteFrame=this.jokerSuitBig[index];
        }else{
            var point=this.points[this.getPoint(pkid)];
            var suit=this.getSuit(pkid);
            card.joker_suit.node.active=false;
            //点数
            card.point.node.active=true;
            card.point.string=point;
            card.point.node.color=suit%2?this.blackTextColor:this.redTextColor;
            //花色
            card.suit.node.active=true; 
            card.suit.spriteFrame=this.texSuitSmall[suit];
            card.mainPic.node.active=true;
            card.mainPic.spriteFrame=this.texSuitBig[suit];
        }
    }
});
