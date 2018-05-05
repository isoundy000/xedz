var crypto = require('../utils/crypto');
var db = require('../utils/db');

var tokenMgr = require('./tokenmgr');
var roomMgr = require('./roommgr');
var userMgr = require('./usermgr');

var io = null;

exports.start = function(config,mgr){
	io = require('socket.io')(config.CLIENT_PORT);
	
	io.sockets.on('connection',function(socket){

		socket.on('login',function(data){
			data = JSON.parse(data);
			if(socket.userId != null){
				//已经登陆过的就忽略
				return;
			}
			var token = data.token;
			var roomId = data.roomid;
			var time = data.time;
			var sign = data.sign;

			console.log(roomId);
			console.log(token);
			console.log(time);
			console.log(sign);

			
			//检查参数合法性
			if(token == null || roomId == null || sign == null || time == null){
				console.log(1);
				socket.emit('login_result',{errcode:1,errmsg:"invalid parameters"});
				return;
			}
			
			//检查参数是否被篡改
			var md5 = crypto.md5(roomId + token + time + config.ROOM_PRI_KEY);
			if(md5 != sign){
				console.log(2);
				socket.emit('login_result',{errcode:2,errmsg:"login failed. invalid sign!"});
				return;
			}
			
			//检查token是否有效
			if(tokenMgr.isTokenValid(token)==false){
				console.log(3);
				socket.emit('login_result',{errcode:3,errmsg:"token out of time."});
				return;
			}
			
			//检查房间合法性
			var userId = tokenMgr.getUserID(token);
			var roomId = roomMgr.getUserRoom(userId);

			userMgr.bind(userId,socket);    //绑定 userId与对应的socket
			socket.userId = userId;

			//返回房间信息
			var roomInfo = roomMgr.getRoom(roomId);
			
			var seatIndex = roomMgr.getUserSeat(userId);
			roomInfo.seats[seatIndex].ip = socket.handshake.address;

			var userData = null;
			var seats = [];
			for(var i = 0; i < roomInfo.seats.length; ++i){
				var rs = roomInfo.seats[i];
				var online = false;
				if(rs.userId > 0){
					online = userMgr.isOnline(rs.userId);
				}

				seats.push({
					userid:rs.userId,
					ip:rs.ip,
					score:rs.score,
					name:rs.name,
					online:online,
					ready:rs.ready,
					seatIndex:i
				});

				if(userId == rs.userId){
					userData = seats[i];
				}
			}

			//通知前端
			var ret = {
				errcode:0,
				errmsg:"ok",
				data:{
					roomid:roomInfo.id,
					conf:roomInfo.conf,
					numofgames:roomInfo.numOfGames,
					seats:seats
				}
			};
			socket.emit('login_result',ret);

			//通知其它客户端
			userMgr.broacastInRoom('new_user_comes_push',userData,userId);
			
			socket.gameMgr = roomInfo.gameMgr;

            /*重要，非常重要*/
			//玩家上线，检查准备状态
			if(userData.ready){
				socket.gameMgr.setReady(userId);
			}
			
 
			socket.emit('login_finished');

			if(roomInfo.dr != null){
				var dr = roomInfo.dr;
				var ramaingTime = (dr.endTime - Date.now()) / 1000;
				var data = {
					time:ramaingTime,
					states:dr.states
				}
				userMgr.sendMsg(userId,'dissolve_notice_push',data);	
			}
		});

		//检测是否有未完成的交换位置请求
		socket.on('test_change_seat_req',function(){
			var roomId=roomMgr.getUserRoom(socket.userId);
			var chSeatReq=roomMgr.getChSeatReq(roomId);
			var seatIndex=roomMgr.getUserSeat(socket.userId);
			if(chSeatReq != null){
				if(seatIndex == chSeatReq.toIndex){
					socket.emit('change_seat_req_push',chSeatReq);	//让接收方确认请求
				}else{
					socket.emit('wait_change_seat_push',chSeatReq);	//让非接收方等待
				}
			}
		});
		//交换位置请求
		socket.on('change_seat_req',function(data){
			data = JSON.parse(data);
			console.log("change_seat_req");
			console.log(data);
			console.log(data[userId]);
			console.log(data[roomId]);
			console.log(data.fromIndex);
			console.log(data[toIndex]);
			if(data == null || data.userId == null || data.roomId == null || 
				data.fromIndex == null || data.toIndex == null){
				return;
			}
			var userId = socket.userId;
			console.log(userId);
			if(userId == null || userId != data.userId){
				return;
			}
			var roomId=roomMgr.getUserRoom(userId);
			console.log(roomId);
			if(roomId == null || roomId != data.roomId){
				return;
			}
			var fromIndex=data.fromIndex;
			var toIndex=data.toIndex;
			
			
			var chSeatReq=roomMgr.getChSeatReq(roomId);
			if(chSeatReq != null){
				if(seatIndex == chSeatReq.toIndex){
					socket.emit('change_seat_req_push',chSeatReq);	//让接收方确认请求
				}else{
					socket.emit('wait_change_seat_push',chSeatReq);	//让非接收方等待
				}
				return;
			}

			roomMgr.addChSeatReq(roomId,userId,fromIndex,toIndex);	//保存目前正在进行的位置交换请求

			var roomInfo=roomMgr.getRoom(roomId);
			for(var i=0;i<roomInfo.seats.length;++i){
				var seat=roomInfo.seats[i];
				if(seat.userId == 0){
					continue;
				}
				if(i == fromIndex){
					socket.emit('wait_change_seat_push',data);	//让请求方等待
				}else if(i == toIndex){
					userMgr.sendMsg(seat.userId,'change_seat_req_push',data);	//让接收方确认请求
				}else{
					userMgr.sendMsg(seat.userId,'wait_change_seat_push',data);	//让其他玩家等待
				}
			}
		});

		//交换位置
		socket.on('change_seat',function(data){
			data = JSON.parse(data);
			if(data == null || data.userId == null || data.roomId == null || 
				data.fromIndex == null || data.toIndex == null){
				return;
			}

			var chSeatReq=roomMgr.getChSeatReq(data.roomId);
			if(chSeatReq == null || data.fromIdex!=chSeatReq.fromIdex ||
				data.toIndex != chSeatReq.toIndex || data.userId != chSeatReq.userId){
				return;
			}

			if(!data.canChange){
				roomMgr.deleteChSeatReq(chSeatReq.roomId);
				userMgr.broacastInRoom("change_seat_result",
					{errcode:1,errmsg:"拒绝交换位置"},socket.userId,true);
			}else{
				roomMgr.changeSeat(chSeatReq.roomId,function(ret){
					if(ret!=0){
						userMgr.broacastInRoom("change_seat_result",
							{errcode:2,errmsg:"交换位置失败"},socket.userId,true);
					}else{
						var roomInfo=roomMgr.getRoom(chSeatReq.roomId);

						var seats = [];
						for(var i = 0; i < roomInfo.seats.length; ++i){
							var rs = roomInfo.seats[i];
							var online = false;
							if(rs.userId > 0){
								online = userMgr.isOnline(rs.userId);
							}

							seats.push({
								userid:rs.userId,
								ip:rs.ip,
								score:rs.score,
								name:rs.name,
								online:online,
								ready:rs.ready,
								seatIndex:rs.seatIndex,
							});
						}

						var ret={
							errcode:0,
							errmsg:"",
							data:{
								seats:seats
							}
						}
						console.log(ret);
						userMgr.broacastInRoom("change_seat_result",ret,socket.userId,true);
					}
				});
			}
		});

		//玩家准备
		socket.on('prepare_change',function(data){
			console.log("prepare_change");
			console.log(data);
			data = JSON.parse(data);
			var ready=data.ready;

			roomMgr.setReady(socket.userId,ready);	//修改准备状态

			var ret = {
				errcode:0,
				errmsg:"",
				data:{
					userId:socket.userId,
					ready:ready
				}
			};
			userMgr.broacastInRoom("prepare_change_push",ret,socket.userId,true);
			if(ready){
			 	socket.gameMgr.setReady(socket.userId);
			}

		});

		//起牌过
		socket.on('qipai_guo',function(data){
			if(socket.userId == null){
				return;
			}
			socket.gameMgr.qipaiGuo(socket.userId);
		});

		//定主
		socket.on('game_dingzhu',function(data){
			console.log("game_dingzhu");
			if(socket.userId == null){
				return;
			}
			data = JSON.parse(data);
			if(data == null || data.suit == null || data.suit < 0 || data.suit > 3){
				return;
			}
			socket.gameMgr.doDingzhu(socket.userId,data.suit);
		});

		//反
		socket.on('game_fan',function(data){
			console.log("game_fan");
			if(socket.userId == null){
				return;
			}
			data = JSON.parse(data);
			if(data == null){
				return;
			}

			socket.gameMgr.doFan(socket.userId,data);
		});

		//扣底牌
		socket.on('game_zhuang_koudipai',function(data){
			console.log("game_zhuang_koudipai");
			if(socket.userId == null){
				return;
			}
			data = JSON.parse(data);
			if(data == null){
				return;
			}

			socket.gameMgr.doKoudipai(socket.userId,data);
		});

		//出牌
		socket.on('chupai',function(data){
			console.log("chupai");
			if(socket.userId == null){
				return;
			}
			data = JSON.parse(data);
			if(data == null){
				return;
			}

			socket.gameMgr.doChupai(socket.userId,data);
		});

		//成Q杠
		socket.on('qgang',function(data){
			console.log("Q gang");
			if(socket.userId == null){
				return;
			}
			data = JSON.parse(data);
			if(data == null){
				return;
			}

			socket.gameMgr.doQgang(socket.userId,data.choice);
		});

		//翻底牌定主
		socket.on('fandipai_dingzhu',function(data){
			console.log("fandipai_dingzhu");
			if(socket.userId == null){
				return;
			}
			data = JSON.parse(data);
			if(data == null){
				return;
			}

			socket.gameMgr.doDipaiDingzhu(socket.userId,data.pkIndex);
		});

		socket.on('jingong',function(data){
			console.log("jingong");
			if(socket.userId == null){
				return;
			}
			data = JSON.parse(data);
			if(data == null){
				return;
			}

			socket.gameMgr.doJingong(socket.userId,data.pkId);
		});

		//革命
		socket.on('geming',function(data){
			console.log("geming");
			if(socket.userId == null){
				return;
			}
			socket.gameMgr.doGeming(socket.userId);
		});

		//聊天
		socket.on('chat',function(data){
			if(socket.userId == null){
				return;
			}
			var chatContent = data;
			userMgr.broacastInRoom('chat_push',{sender:socket.userId,content:chatContent},socket.userId,true);
		});
		
		//快速聊天
		socket.on('quick_chat',function(data){
			if(socket.userId == null){
				return;
			}
			var chatId = data;
			userMgr.broacastInRoom('quick_chat_push',{sender:socket.userId,content:chatId},socket.userId,true);
		});
		
		//语音聊天
		socket.on('voice_msg',function(data){
			if(socket.userId == null){
				return;
			}
			console.log(data.length);
			userMgr.broacastInRoom('voice_msg_push',{sender:socket.userId,content:data},socket.userId,true);
		});
		
		//表情
		socket.on('emoji',function(data){
			if(socket.userId == null){
				return;
			}
			var phizId = data;
			userMgr.broacastInRoom('emoji_push',{sender:socket.userId,content:phizId},socket.userId,true);
		});
		
		//解散房间
		socket.on('dispress',function(data){
			var userId = socket.userId;
			if(userId == null){
				return;
			}

			var roomId = roomMgr.getUserRoom(userId);
			if(roomId == null){
				return;
			}

			//如果游戏已经开始，则不可以
			if(socket.gameMgr.hasBegan(roomId)){
				return;
			}

			//如果不是房主，则不能解散房间
			if(roomMgr.isCreator(roomId,userId) == false){
				return;
			}
			
			userMgr.broacastInRoom('dispress_push',{},userId,true);
			userMgr.kickAllInRoom(roomId);
			roomMgr.destroy(roomId);
			socket.disconnect();
		});

		//解散房间申请
		socket.on('dissolve_request',function(data){
			var userId = socket.userId;
			console.log(1);
			if(userId == null){
				console.log(2);
				return;
			}

			var roomId = roomMgr.getUserRoom(userId);
			if(roomId == null){
				console.log(3);
				return;
			}

			//如果游戏未开始，则不可以
			if(socket.gameMgr.hasBegan(roomId) == false){
				console.log(4);
				return;
			}

			var ret = socket.gameMgr.dissolveRequest(roomId,userId);
			if(ret != null){
				var dr = ret.dr;
				var ramaingTime = (dr.endTime - Date.now()) / 1000;
				var data = {
					time:ramaingTime,
					states:dr.states
				}
				console.log(5);
				userMgr.broacastInRoom('dissolve_notice_push',data,userId,true);
			}
			console.log(6);
		});

		//同意解散房间
		socket.on('dissolve_agree',function(data){
			var userId = socket.userId;

			if(userId == null){
				return;
			}

			var roomId = roomMgr.getUserRoom(userId);
			if(roomId == null){
				return;
			}

			var ret = socket.gameMgr.dissolveAgree(roomId,userId,true);
			if(ret != null){
				var dr = ret.dr;
				var ramaingTime = (dr.endTime - Date.now()) / 1000;
				var data = {
					time:ramaingTime,
					states:dr.states
				}
				userMgr.broacastInRoom('dissolve_notice_push',data,userId,true);

				var doAllAgree = true;
				for(var i = 0; i < dr.states.length; ++i){
					if(dr.states[i] == false){
						doAllAgree = false;
						break;
					}
				}

				if(doAllAgree){
					socket.gameMgr.doDissolve(roomId);	
					socket.disconnect();				
				}
			}
		});	
		
		socket.on('force_dispress',function(data){
			var userId = socket.userId;

			if(userId == null){
				return;
			}

			var roomId = roomMgr.getUserRoom(userId);
			if(roomId == null){
				return;
			}
			
			socket.gameMgr.doDissolve(roomId);	
			socket.disconnect();	
		});
		

		//拒接解散房间
		socket.on('dissolve_reject',function(data){
			var userId = socket.userId;

			if(userId == null){
				return;
			}

			var roomId = roomMgr.getUserRoom(userId);
			if(roomId == null){
				return;
			}

			var ret = socket.gameMgr.dissolveAgree(roomId,userId,false);
			if(ret != null){
				userMgr.broacastInRoom('dissolve_cancel_push',{},userId,true);
			}
		});

        //断开链接
		socket.on('disconnect',function(data){
			var userId = socket.userId;
			if(!userId){
				return;
			}
			var data = {
				userid:userId,
				online:false
			};

			//通知房间内其它玩家
			userMgr.broacastInRoom('user_state_push',data,userId);

			//清除玩家的socket信息
			userMgr.del(userId);
			socket.userId = null;
		});

		//退出房间
		socket.on('exit',function(data){
			var userId = socket.userId;
			if(userId == null){
				return;
			}

			var roomId = roomMgr.getUserRoom(userId);
			if(roomId == null){
				return;
			}

			//如果游戏已经开始，则不可以
			if(socket.gameMgr.hasBegan(roomId)){
				return;
			}

			//如果是房主，则只能走解散房间
			if(roomMgr.isCreator(userId)){
				return;
			}
			
			//通知其它玩家，有人退出了房间
			userMgr.broacastInRoom('exit_notify_push',userId,userId,false);
			
			roomMgr.exitRoom(userId);
			userMgr.del(userId);
			
			socket.emit('exit_result');
			socket.disconnect();
		});
        
        socket.on('game_ping',function(data){
			var userId = socket.userId;
			if(!userId){
				return;
			}
			//console.log('game_ping');
			socket.emit('game_pong');
		});

	});

	console.log("game server is listening on " + config.CLIENT_PORT);	
};

