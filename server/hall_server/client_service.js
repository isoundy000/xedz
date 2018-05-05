var crypto = require('../utils/crypto');
var express = require('express');
var db = require('../utils/db');
var http = require('../utils/http');
var room_service = require("./room_service");

var app = express();
var config = null;

function check_account(req,res){
	var account = req.query.account;
	var sign = req.query.sign;

	if(account == null || sign == null){
		http.send(res,1,"我不知道的错误");
		return false;
	}
	/*
	var serverSign = crypto.md5(account + req.ip + config.ACCOUNT_PRI_KEY);
	if(serverSign != sign){
		http.send(res,2,"login failed.");
		return false;
	}
	*/
	return true;
}

exports.start = function($config){
	config = $config;
	app.listen(config.CLEINT_PORT);
	console.log("client service is listening on port " + config.CLEINT_PORT);
};

//设置跨域访问
app.all('*', function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
	res.header("X-Powered-By",' 3.2.1');
	res.header("Content-Type", "application/json;charset=utf-8");
	next();
});

app.get('/is_server_online',function(req,res){
	if(!check_account(req,res)){
		return;
	}
	var ip = req.query.ip;
	var port = req.query.port;
	room_service.isServerOnline(ip,port,function(isonline){
		var ret = {
			isonline:isonline
		};
		http.send(res,0,"ok",ret);
	}); 
});


app.get('/login',function(req,res){
	console.log("req account: "+req.query.account);
    if(!check_account(req,res)){
        return;
    }
    var ip = req.ip;
    if(ip.indexOf("::ffff:")!=-1){
        ip = ip.substr(7);
	}
	var account = req.query.account;
	console.log(account);

    db.get_user_data(account,function(data){
		console.log("user data: " + data);
        if(data == null){
            http.send(res,0,"ok");
            return;
        }

        var ret = {
            account:data.account,
            userid:data.userid,
            name:data.name,
            lv:data.lv,
			exp:data.exp,
			coins:data.coins,
			gems:data.gems,
			ip:ip,
			sex:data.sex,
        };

        db.get_room_id_of_user(data.userid,function(roomId){
            //如果用户处于房间中，则需要对其房间进行检查。 如果房间还在，则通知用户进入
			if(roomId != null){
				//检查房间是否存在于数据库中
				db.is_room_exist(roomId,function (retval){
					if(retval){
						ret.roomid = roomId;
					}
					else{
						//如果房间不在了，表示信息不同步，清除掉用户记录
						db.set_room_id_of_user(data.userid,null);
					}
					http.send(res,0,"ok",ret);
				});
			}
			else {
				http.send(res,0,"ok",ret);
			}
        });
    });
});

app.get('/create_user',function(req,res){
	if(!check_account(req,res)){
		return;
	}
	var account = req.query.account;
	var name = req.query.name;
	var coins = 1000;
	var gems = 21;
	console.log(account);

	db.is_user_exist(account,function(ret){
		if(!ret){
			db.create_user(account,name,coins,gems,0,null,function(ret){
				if (ret == null) {
					http.send(res,2,"system error.");
				}
				else{
					http.send(res,0,"ok");					
				}
			});
		}
		else{
			http.send(res,1,"account have already exist.");
		}
	});
});


app.get('/create_private_room',function(req,res){
	//验证参数合法性
	var data = req.query;
	//验证玩家身份
	if(!check_account(req,res)){
		return;
	}

	var account = data.account;

	data.account = null;
	data.sign = null;
	var conf = data.conf;
	db.get_user_data(account,function(data){
		if(data == null){
			http.send(res,1,"system error");
			return;
		}
		var userId = data.userid;
		var name = data.name;
		//验证玩家状态
		db.get_room_id_of_user(userId,function(roomId){
			if(roomId != null){
				http.send(res,-1,"user is playing in room now.");
				return;
			}
			//创建房间
			room_service.createRoom(account,userId,conf,function(err,roomId){
				if(err == 0 && roomId != null){
					room_service.enterRoom(userId,name,roomId,function(errcode,enterInfo){
						if(enterInfo){
							var ret = {
								roomid:roomId,
								ip:enterInfo.ip,
								port:enterInfo.port,
								token:enterInfo.token,
								time:Date.now()
							};
							ret.sign = crypto.md5(ret.roomid + ret.token + ret.time + config.ROOM_PRI_KEY);
							http.send(res,0,"ok",ret);
						}
						else{
							http.send(res,errcode,"room doesn't exist.");
						}
					});
				}
				else{
					http.send(res,err,"create failed.");					
				}
			});
		});
	});
});

app.get('/enter_private_room',function(req,res){
	var data = req.query;
	var roomId = data.roomid;
	if(roomId == null){
		http.send(res,-1,"parameters don't match api requirements.");
		return;
	}
	if(!check_account(req,res)){
		return;
	}

	var account = data.account;

	db.get_user_data(account,function(data){
		if(data == null){
			http.send(res,-1,"system error");
			return;
		}
		var userId = data.userid;
		var name = data.name;

		//验证玩家状态
		//todo
		//进入房间
		room_service.enterRoom(userId,name,roomId,function(errcode,enterInfo){
			if(enterInfo){
				var ret = {
					roomid:roomId,
					ip:enterInfo.ip,
					port:enterInfo.port,
					token:enterInfo.token,
					time:Date.now()
				};
				ret.sign = crypto.md5(roomId + ret.token + ret.time + config.ROOM_PRI_KEY);
				http.send(res,0,"ok",ret);
			}
			else{
				http.send(res,errcode,"enter room failed.");
			}
		});
	});
});