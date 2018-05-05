//得到扑克花色
exports.getSuit = function(poker){
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
};

exports.getPoint = function(poker){
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
};

exports.toZhupai=function(poker){
    if(poker<80){
        return poker+80;
    }else if(poker>=160 && poker<164){
        return poker+4;
    }else if(poker>=170 && poker<174){
        return poker+4;
    }else{
        return poker;
    }
}; 

exports.toFanpai=function(poker){
    var point = exports.getPoint(poker);
    var suit = exports.getSuit(poker);
    if(point==3){
        return 190+suit;
    }else if(point==5){
        return 200+(suit==0?4:suit);
    }
};

exports.containSuit=function(holds,suit,zhu){
    if(suit == zhu){
        for(var i=0;i<holds.length;++i){
            if(holds[i]>80){
                return true;
            }
        }
    }else{
        for(var i=0;i<holds.length;++i){
            if(holds[i] <80 && exports.getSuit(holds[i]) == suit){
                return true;
            }
        }
    }
    return false;
};

exports.checkSameSuit = function(holds,zhu){
    if(!holds || holds.length == 0){
        return -1;
    }
    var suit = holds[0]>80?zhu:exports.getSuit(holds[0]);
    for(var i = 1;i<holds.length;++i){
        var suit2 = holds[i]>80?zhu:exports.getSuit(holds[i]);
        if(suit2 != suit){
            return -1;
        }
    }

    return suit;

};

exports.checkSamePoint = function(holds){
    if(!holds || holds.length == 0){
        return -1;
    }
    var point = exports.getPoint(holds[0]);
    for(var i=1;i<holds.length;++i){
        var point1 = exports.getPoint(holds[i]);
        if(point != point1){
            return -1;
        }
    }
    return point;
}

exports.getMinPai = function(holds,suit,zhu){
    if(!holds || holds.length == 0){
        return -1;
    }
    var minPai = 300;
    if(suit!=null && suit != -1){
        for(var i=0;i<holds.length;++i){
            var s = holds[i]>80?zhu:exports.getSuit(holds[i]);
            if(s != suit){
                continue;
            }
            if(holds[i]<minPai){
                minPai = holds[i];
            }
        }
    }else{
        for(var i=0;i<holds.length;++i){
            if(holds[i]<minPai){
                minPai = holds[i];
            }
        }
    }
    return minPai;

};

exports.getMaxPai = function(holds,suit,zhu){
    if(!holds || holds.length == 0){
        return -1;
    }
    var maxPai = 0;
    if(suit && suit != -1){
        for(var i=0;i<holds.length;++i){
            var s = holds[i]>80?zhu:exports.getSuit(holds[i]);
            if(s != suit){
                continue;
            }
            if(holds[i]>maxPai){
                maxPai = holds[i];
            }
        }
    }else{
        for(var i=0;i<holds.length;++i){
            if(holds[i]>maxPai){
                maxPai = holds[i];
            }
        }
    }
    return maxPai;
};

exports.splicePais = function(holds,pais){
    var holdsCpy = holds.slice(0);  //数组复制

    for(var i in pais){
        var index = holdsCpy.indexOf(pais[i]);
        if(index != -1){
            holdsCpy.splice(index,1);
        }
    }

    return holdsCpy;
};

exports.getSuitCountOfHolds = function(holds,suit,zhu){
    var count = 0;

    if(suit == zhu){
        for(var i=0;i<holds.length;++i){
            if(holds[i]>80){
                count++;
            }
        }
    }else{
        for(var i=0;i<holds.length;++i){
            if(holds[i] <80 && exports.getSuit(holds[i]) == suit){
                count++;
            }
        }
    }
    return count;
};

exports.getZhuCountOfHolds = function(holds,zhu){
    var count =0;
    for(var i=0;i<holds.length;++i){
        if(holds[i]>80){
            count++;
        }
    }
    return count;
};

exports.getTotalScoreOfHolds = function(holds){
    var score = 0;
    for(var i=0;i<holds.length;++i){
        var pai = holds[i];
        var point = exports.getPoint(pai);
        if(point == 5){
            score+=5;
        }else if(point == 10 || point == 13){
            score+=10;
        }
    }
    return score;
};

exports.getTotalHolds = function(seatData){
    var holds = seatData.holds.slice(0);
    for(var i=0;i<seatData.sanfans.length;++i){
        if(seatData.sanfans[i]!=null){
            holds.push(seatData.sanfans[i]);
        }
        
    }
    for(var i=0;i<seatData.wufans.length;++i){
        if(seatData.wufans[i]!=null){
            holds.push(seatData.wufans[i]);
        }
    }
    return holds;
}