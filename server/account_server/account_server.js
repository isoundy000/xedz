var crypto = require('../utils/crypto');
var express = require('express');
var db = require('../utils/db');
var http = require('../utils/http');

var app = express();
var hallAddr = "";

function send(res,ret){
    var str = JSON.stringify(ret);
    res.send(str);
}

var config = null;

exports.start = function(cfg){
    config=cfg;
    hallAddr = config.HALL_IP + ":" + config.HALL_CLIENT_PORT;
    app.listen(config.CLIENT_PORT);
    console.log("account server is listening on " + config.CLIENT_PORT);
}

//设置跨域访问
app.all('*',function(req,res,next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
    res.header("X-Powered-By",' 3.2.1')
    res.header("Content-Type", "application/json;charset=utf-8");
    next();
});

app.get('/get_serverinfo',function(req,res){
    var ret = {
        version:config.VERSION,
        hall:hallAddr,
        appweb:config.APP_WEB,
    };
    send(res,ret);
});

//游客登录，账号服务器生成游客账户和签名
app.get('/guest',function(req,res){
	var account = "guest_" + req.query.account;
	var sign = crypto.md5(account + req.ip + config.ACCOUNT_PRI_KEY);
	var ret = {
		errcode:0,
		errmsg:"ok",
		account:account,
		halladdr:hallAddr,
		sign:sign
	}
	send(res,ret);
});

//获取玩家基本信息，在大厅显示用户头像等基本信息所用ImageLoader
app.get('/base_info',function(req,res){
	var userid = req.query.userid;
	db.get_user_base_info(userid,function(data){
		var ret = {
	        errcode:0,
	        errmsg:"ok",
			name:data.name,
			sex:data.sex,
	        headimgurl:data.headimg
	    };
	    send(res,ret);
	});
});