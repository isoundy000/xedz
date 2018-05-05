    //四种花色并列顺序为：黑桃、红桃、黑梅、方块
    //53:方块5，52：大王，51：小王，50：黑桃Q，49-46：J，45-42：2；
    //41-32：黑桃A,K,10,9,8,7,6,5,4,3,
    //31-21：红桃A,K,Q，10，9，8,7,6,5,4,3,
    //20-10：黑梅A,K,Q，10，9，8,7,6,5,4,3,
    //9-0：方块A,K,Q，10，9，8,7,6,4,3,
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
        this.points=[
            '3','4','6','7','8','9','10','Q','K','A',
            '3','4','5','6','7','8','9','10','Q','K','A',
            '3','4','5','6','7','8','9','10','Q','K','A',
            '3','4','5','6','7','8','9','10','K','A',
            '2','2','2','2','J','J','J','J',
            'Q','','','5'];
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

    sortPK:function(pokers,zhu){
        var self = this;
        pokers.sort(function(a,b){
            if(zhu >= 0){
                if(a>=46 && a<=49 && b>=46 && b<=49){   //如果是J
                    if(a-46==zhu){
                        return 1;
                    }
                    else if(b-46==zhu){
                        return -1;
                    }
                }else if(a>=42 && a<=45 && b>=42 && b<=45){ //如果是2
                    if(a-42==zhu){
                        return 1;
                    }else if(b-42==zhu){
                        return -1;
                    }
                }else if(a<42 && b<42){ //如果是普通牌
                    var aZhu=self.isZhu(a); //判断a是否是主
                    var bZhu=self.isZhu(b); //判断b是否是主
                    if(aZhu && !bZhu){
                        return 1;
                    }else if(!aZhu && bZhu){
                        return -1;
                    }
                }
            }
            return a - b;
        });
    },

    //判断是否是主
    isZhu:function(poker,zhu){
        if(poker<10){
            return zhu==0;
        }else if(poker<21){
            return zhu==1;
        }else if(poker<32){
            return zhu==2;
        }else if(poker<42){
            return zhu==3;
        }else{
            return true;
        }
    },

    //得到扑克花色
    getSuit(poker){
        if(poker<10){
            return 0;
        }else if(poker<21){
            return 1;
        }else if(poker<32){
            return 2;
        }else if(poker<42){
            return 3;
        }else if(poker<46){
            return poker-42;
        }else if(poker<50){
            return poker-46;
        }else if(poker==50){
            return 3;
        }else if(poker==53){
            return 0;
        }else{
            return poker-51+4;
        }
    },

    //得到点数
    getPoint:function(poker){
        return this.point[poker];
    },

    setCardByPKID:function(card,pkid){
        if(pkid<0 || pkid>53){
            return;
        }
        card.cardBG.spriteFrame=this.texFrontBG;
        if(pkid == 51 || pkid == 52){
            var index=pkid-51;
            card.point.node.active=false;
            card.suit.node.active=false;
            card.joker_suit.node.active=true;
            card.joker_suit.spriteFrame=this.jokerSuitSmall[index];
            card.mainPic.node.active=true;
            card.mainPic.spriteFrame=this.jokerSuitBig[index];
        }else{
            var point=this.getPoint(pkid);
            var suit=this.getSuit(pkid);
            card.joker_suit.node.active=false;
            //点数
            card.point.node.active=true;
            card.point.string=point;
            card.point.node.color=suit%2?this.redTextColor:this.blackTextColor;
            //花色
            card.suit.node.active=true; 
            card.suit.spriteFrame=this.texSuitSmall[suit];
            card.mainPic.node.active=true;
            card.mainPic.spriteFrame=this.texSuitBig[suit];
        }
    }
});
