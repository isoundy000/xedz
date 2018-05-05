var db = require('../utils/db');

var rooms = {};
var creatingRooms = {};

var userLocation = {};
var totalRooms = 0;

//交换位置请求，同时只能有一个
var chSeatReq = {};

var MAX_FAN = [3,4,5];
var JU_SHU = [12,36];
var JU_SHU_COST = [2,3];

function generateRoomId(){
	var roomId = "";
	for(var i = 0; i < 6; ++i){
		roomId += Math.floor(Math.random()*10);
	}
	return roomId;
}

function constructRoomFromDb(dbdata){
	var roomInfo = {
		uuid:dbdata.uuid,
		id:dbdata.id,
		numOfGames:dbdata.num_of_turns,
		createTime:dbdata.create_time,
		nextButton:dbdata.next_button,
		seats:new Array(4),
		conf:JSON.parse(dbdata.base_info)
	};


	if(roomInfo.conf.type == "xedz"){
		roomInfo.gameMgr = require("./gamemgr_xedz");
	}
	var roomId = roomInfo.id;

	for(var i = 0; i < 4; ++i){
		var s = roomInfo.seats[i] = {};
		s.userId = dbdata["user_id" + i];
		s.score = dbdata["user_score" + i];
		s.name = dbdata["user_name" + i];
		s.ready = false;
		s.seatIndex = i;

		if(s.userId > 0){
			userLocation[s.userId] = {
				roomId:roomId,
				seatIndex:i
			};
		}
	}
	rooms[roomId] = roomInfo;
	totalRooms++;
	return roomInfo;
}

exports.getTotalRooms = function(){
	return totalRooms;
};

exports.createRoom = function(creator,roomConf,gems,ip,port,callback){
	if(
		roomConf.type == null
		|| roomConf.jushuxuanze == null){
		callback(1,null);
		return;
	}

	if(roomConf.jushuxuanze < 0 || roomConf.jushuxuanze > JU_SHU.length){
		callback(1,null);
		return;
	}
	
	var cost = JU_SHU_COST[roomConf.jushuxuanze];
	if(cost > gems){
		callback(2222,null);
		return;
	}

	var fnCreate = function(){
		var roomId = generateRoomId();
		if(rooms[roomId] != null || creatingRooms[roomId] != null){
			fnCreate();
		}
		else{
			creatingRooms[roomId] = true;
			db.is_room_exist(roomId, function(ret) {

				if(ret){
					delete creatingRooms[roomId];
					fnCreate();
				}
				else{
					var createTime = Math.ceil(Date.now()/1000);
					var roomInfo = {
						uuid:"",
						id:roomId,
						numOfGames:0,
						createTime:createTime,
						nextButton:-1,
						seats:[],
						conf:{
							type:roomConf.type,
						    maxGames:JU_SHU[roomConf.jushuxuanze],
						    creator:creator,
						}
					};
					
					if(roomConf.type == "xedz"){
						roomInfo.gameMgr = require("./gamemgr_xedz");
					}
					console.log(roomInfo.conf);
					
					for(var i = 0; i < 4; ++i){
						roomInfo.seats.push({
							userId:0,
							score:0,
							name:"",
							ready:false,
							seatIndex:i,
						});
					}
					

					//写入数据库
					var conf = roomInfo.conf;
					db.create_room(roomInfo.id,roomInfo.conf,ip,port,createTime,function(uuid){
						delete creatingRooms[roomId];
						if(uuid != null){
							roomInfo.uuid = uuid;
							console.log(uuid);
							rooms[roomId] = roomInfo;
							totalRooms++;
							db.update_next_button(roomId,-1,null);
							callback(0,roomId);
						}
						else{
							callback(3,null);
						}
					});
				}
			});
		}
	}

	fnCreate();
};

exports.enterRoom = function(roomId,userId,userName,callback){
	var fnTakeSeat = function(room){
		if(exports.getUserRoom(userId) == roomId){
			//已存在
			return 0;
		}

		for(var i = 0; i < 4; ++i){
			var seat = room.seats[i];
			if(seat.userId <= 0){
				seat.userId = userId;
				seat.name = userName;
				userLocation[userId] = {	//保存user对应的位置信息（房间和座位）
					roomId:roomId,
					seatIndex:i
				};
				//console.log(userLocation[userId]);
				db.update_seat_info(roomId,i,seat.userId,"",seat.name);
				//正常
				return 0;
			}
		}	
		//房间已满
		return 1;	
	}
	var room = rooms[roomId];
	if(room){
		var ret = fnTakeSeat(room);
		callback(ret);
	}
	else{
		db.get_room_data(roomId,function(dbdata){
			if(dbdata == null){
				//找不到房间
				callback(2);
			}
			else{
				//construct room.
				room = constructRoomFromDb(dbdata);
				//
				var ret = fnTakeSeat(room);
				callback(ret);
			}
		});
	}
};

exports.getUserRoom = function(userId){
	var location = userLocation[userId];
	if(location != null){
		return location.roomId;
	}
	return null;
};

exports.getRoom = function(roomId){
	return rooms[roomId];
};

exports.isCreator = function(roomId,userId){
	var roomInfo = rooms[roomId];
	if(roomInfo == null){
		return false;
	}
	return roomInfo.conf.creator == userId;
};


exports.getUserSeat = function(userId){
	var location = userLocation[userId];
	//console.log(userLocation[userId]);
	if(location != null){
		return location.seatIndex;
	}
	return null;
};

exports.setReady = function(userId,value){
	var roomId = exports.getUserRoom(userId);
	if(roomId == null){
		return;
	}

	var room = exports.getRoom(roomId);
	if(room == null){
		return;
	}

	var seatIndex = exports.getUserSeat(userId);
	if(seatIndex == null){
		return;
	}

	var s = room.seats[seatIndex];
	s.ready = value;
};

exports.destroy = function(roomId){
	var roomInfo = rooms[roomId];
	if(roomInfo == null){
		return;
	}

	for(var i = 0; i < 4; ++i){
		var userId = roomInfo.seats[i].userId;
		if(userId > 0){
			delete userLocation[userId];
			db.set_room_id_of_user(userId,null);
		}
	}
	
	delete rooms[roomId];
	totalRooms--;
	db.delete_room(roomId);
};

exports.getChSeatReq=function(roomId){
	if(chSeatReq[roomId]==null){
		return null;
	}
	return chSeatReq[roomId];
}

exports.addChSeatReq=function(roomId,userId,fromIndex,toIndex){
	var roomInfo=rooms[roomId];
	if(roomInfo == null){//没有该房间的信息
		return;	
	}
	var req={
		fromIndex:fromIndex,
		toIndex:toIndex,
		userId:userId,
		roomId:roomId
	};
	chSeatReq[roomId]=req;
};

exports.deleteChSeatReq=function(roomId){
	if(chSeatReq[roomId]==null){
		return;
	}
	delete chSeatReq[roomId];
}

exports.changeSeat=function(roomId,callback){
	var roomInfo=rooms[roomId];
	if(roomInfo == null){
		callback(1);//没有该房间的信息
		return;	
	}

	var req=chSeatReq[roomId];
	if(req == null){
		callback(2);//该房间没有交换请求
		return;	
	}
	var fromSeat=roomInfo.seats[req.fromIndex];
	var toSeat=roomInfo.seats[req.toIndex];

	

	//更新数据库
	db.update_seat_info(roomId,req.fromIndex,toSeat.userId,"",toSeat.name,function(ret){
		if(ret==true){
			db.update_seat_info(roomId,req.toIndex,fromSeat.userId,"",fromSeat.name,function(ret){
				if(ret==true){
					//修改roomMgr的相关数据
					toSeat.seatIndex=req.fromIndex;
					userLocation[toSeat.userId].seatIndex=req.fromIndex;
					roomInfo.seats[req.fromIndex]=toSeat;
					
					fromSeat.seatIndex=req.toIndex;
					userLocation[fromSeat.userId].seatIndex=req.toIndex;
					roomInfo.seats[req.toIndex]=fromSeat;

					delete chSeatReq[roomId];	//删除交换位置请求

					callback(0);	//交换位置成功

				}else{
					delete chSeatReq[roomId];	//删除交换位置请求
					callback(3);	//数据库操作失败
				}
			})
		}else{
			delete chSeatReq[roomId];	//删除交换位置请求
			callback(3);	//数据库操作失败
		}
	});

};

exports.exitRoom = function(userId){
	var location = userLocation[userId];
	if(location == null)
		return;

	var roomId = location.roomId;
	var seatIndex = location.seatIndex;
	var room = rooms[roomId];
	delete userLocation[userId];
	if(room == null || seatIndex == null) {
		return;
	}

	var seat = room.seats[seatIndex];
	seat.userId = 0;
	seat.name = "";

	var numOfPlayers = 0;
	for(var i = 0; i < room.seats.length; ++i){
		if(room.seats[i].userId > 0){
			numOfPlayers++;
		}
	}
	
	db.set_room_id_of_user(userId,null);

	if(numOfPlayers == 0){
		exports.destroy(roomId);
	}
};
