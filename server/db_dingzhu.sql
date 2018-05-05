/*
Navicat MySQL Data Transfer

Source Server         : localhost_127.0.0.1
Source Server Version : 50505
Source Host           : 127.0.0.1:3306
Source Database       : db_dingzhu

Target Server Type    : MYSQL
Target Server Version : 50505
File Encoding         : 65001

Date: 2018-03-31 11:58:24
*/

SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for t_rooms
-- ----------------------------
DROP TABLE IF EXISTS `t_rooms`;
CREATE TABLE `t_rooms` (
  `uuid` char(20) NOT NULL,
  `id` char(8) NOT NULL,
  `base_info` varchar(256) NOT NULL DEFAULT '0',
  `create_time` int(11) NOT NULL,
  `num_of_turns` int(11) NOT NULL DEFAULT '0',
  `next_button` int(11) NOT NULL DEFAULT '0',
  `user_id0` int(11) NOT NULL DEFAULT '0',
  `user_icon0` varchar(128) NOT NULL DEFAULT '',
  `user_name0` varchar(32) NOT NULL DEFAULT '',
  `user_score0` int(11) NOT NULL DEFAULT '0',
  `user_id1` int(11) NOT NULL DEFAULT '0',
  `user_icon1` varchar(128) NOT NULL DEFAULT '',
  `user_name1` varchar(32) NOT NULL DEFAULT '',
  `user_score1` int(11) NOT NULL DEFAULT '0',
  `user_id2` int(11) NOT NULL DEFAULT '0',
  `user_icon2` varchar(128) NOT NULL DEFAULT '',
  `user_name2` varchar(32) NOT NULL DEFAULT '',
  `user_score2` int(11) NOT NULL DEFAULT '0',
  `user_id3` int(11) NOT NULL DEFAULT '0',
  `user_icon3` varchar(128) NOT NULL DEFAULT '',
  `user_name3` varchar(32) NOT NULL DEFAULT '',
  `user_score3` int(11) NOT NULL DEFAULT '0',
  `ip` varchar(16) DEFAULT NULL,
  `port` int(11) DEFAULT '0',
  PRIMARY KEY (`uuid`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ----------------------------
-- Records of t_rooms
-- ----------------------------

-- ----------------------------
-- Table structure for t_users
-- ----------------------------
DROP TABLE IF EXISTS `t_users`;
CREATE TABLE `t_users` (
  `userid` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `account` varchar(64) NOT NULL DEFAULT '' COMMENT '账号',
  `name` varchar(32) DEFAULT NULL COMMENT '用户昵称',
  `sex` int(1) DEFAULT NULL,
  `headimg` varchar(256) DEFAULT NULL,
  `lv` smallint(6) DEFAULT '1' COMMENT '用户等级',
  `exp` int(11) DEFAULT '0' COMMENT '用户经验',
  `coins` int(11) DEFAULT '0' COMMENT '用户金币',
  `gems` int(11) DEFAULT '0' COMMENT '用户宝石',
  `roomid` varchar(8) DEFAULT NULL,
  `history` varchar(4096) NOT NULL DEFAULT '',
  PRIMARY KEY (`userid`),
  UNIQUE KEY `account` (`account`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Records of t_users
-- ----------------------------
INSERT INTO `t_users` VALUES ('10', 'guest_asdf1', '55qH55Sr56iz6LWi', '0', null, '1', '0', '1000', '21', null, '[{\"uuid\":\"1506954315114481923\",\"id\":\"481923\",\"time\":1506954316,\"seats\":[{\"userid\":16,\"name\":\"5Lic6Ziz56iz6LWi\",\"score\":-2},{\"userid\":10,\"name\":\"55qH55Sr56iz6LWi\",\"score\":-10},{\"userid\":11,\"name\":\"5Lic5pa56ZuA5Zyj\",\"score\":16},{\"userid\":12,\"name\":\"5qyn6Ziz6Ieq5pG4\",\"score\":-4}]},{\"uuid\":\"1518834995011335756\",\"id\":\"335756\",\"time\":1518834996,\"seats\":[{\"userid\":18,\"name\":\"5Y2X5a6r5LiN6L6T\",\"score\":0},{\"userid\":10,\"name\":\"55qH55Sr56iz6LWi\",\"score\":0},{\"userid\":11,\"name\":\"5Lic5pa56ZuA5Zyj\",\"score\":0},{\"userid\":12,\"name\":\"5qyn6Ziz6Ieq5pG4\",\"score\":0}]},{\"uuid\":\"1519373322409940630\",\"id\":\"940630\",\"time\":1519373323,\"seats\":[{\"userid\":18,\"name\":\"5Y2X5a6r5LiN6L6T\",\"score\":-3},{\"userid\":10,\"name\":\"55qH55Sr56iz6LWi\",\"score\":1},{\"userid\":11,\"name\":\"5Lic5pa56ZuA5Zyj\",\"score\":1},{\"userid\":12,\"name\":\"5qyn6Ziz6Ieq5pG4\",\"score\":1}]}]');
INSERT INTO `t_users` VALUES ('11', 'guest_asdf2', '5Lic5pa56ZuA5Zyj', '0', null, '1', '0', '1000', '21', null, '[{\"uuid\":\"1506954315114481923\",\"id\":\"481923\",\"time\":1506954316,\"seats\":[{\"userid\":16,\"name\":\"5Lic6Ziz56iz6LWi\",\"score\":-2},{\"userid\":10,\"name\":\"55qH55Sr56iz6LWi\",\"score\":-10},{\"userid\":11,\"name\":\"5Lic5pa56ZuA5Zyj\",\"score\":16},{\"userid\":12,\"name\":\"5qyn6Ziz6Ieq5pG4\",\"score\":-4}]},{\"uuid\":\"1518834995011335756\",\"id\":\"335756\",\"time\":1518834996,\"seats\":[{\"userid\":18,\"name\":\"5Y2X5a6r5LiN6L6T\",\"score\":0},{\"userid\":10,\"name\":\"55qH55Sr56iz6LWi\",\"score\":0},{\"userid\":11,\"name\":\"5Lic5pa56ZuA5Zyj\",\"score\":0},{\"userid\":12,\"name\":\"5qyn6Ziz6Ieq5pG4\",\"score\":0}]},{\"uuid\":\"1519373322409940630\",\"id\":\"940630\",\"time\":1519373323,\"seats\":[{\"userid\":18,\"name\":\"5Y2X5a6r5LiN6L6T\",\"score\":-3},{\"userid\":10,\"name\":\"55qH55Sr56iz6LWi\",\"score\":1},{\"userid\":11,\"name\":\"5Lic5pa56ZuA5Zyj\",\"score\":1},{\"userid\":12,\"name\":\"5qyn6Ziz6Ieq5pG4\",\"score\":1}]}]');
INSERT INTO `t_users` VALUES ('12', 'guest_asdf3', '5qyn6Ziz6Ieq5pG4', '0', null, '1', '0', '1000', '21', null, '[{\"uuid\":\"1506954315114481923\",\"id\":\"481923\",\"time\":1506954316,\"seats\":[{\"userid\":16,\"name\":\"5Lic6Ziz56iz6LWi\",\"score\":-2},{\"userid\":10,\"name\":\"55qH55Sr56iz6LWi\",\"score\":-10},{\"userid\":11,\"name\":\"5Lic5pa56ZuA5Zyj\",\"score\":16},{\"userid\":12,\"name\":\"5qyn6Ziz6Ieq5pG4\",\"score\":-4}]},{\"uuid\":\"1518834995011335756\",\"id\":\"335756\",\"time\":1518834996,\"seats\":[{\"userid\":18,\"name\":\"5Y2X5a6r5LiN6L6T\",\"score\":0},{\"userid\":10,\"name\":\"55qH55Sr56iz6LWi\",\"score\":0},{\"userid\":11,\"name\":\"5Lic5pa56ZuA5Zyj\",\"score\":0},{\"userid\":12,\"name\":\"5qyn6Ziz6Ieq5pG4\",\"score\":0}]},{\"uuid\":\"1519373322409940630\",\"id\":\"940630\",\"time\":1519373323,\"seats\":[{\"userid\":18,\"name\":\"5Y2X5a6r5LiN6L6T\",\"score\":-3},{\"userid\":10,\"name\":\"55qH55Sr56iz6LWi\",\"score\":1},{\"userid\":11,\"name\":\"5Lic5pa56ZuA5Zyj\",\"score\":1},{\"userid\":12,\"name\":\"5qyn6Ziz6Ieq5pG4\",\"score\":1}]}]');
INSERT INTO `t_users` VALUES ('14', 'guest_1501576911302', '6L2p6L6V6ZuA5Zyj', '0', null, '1', '0', '1000', '21', null, '');
INSERT INTO `t_users` VALUES ('25', 'guest_1519783001239', '56uv5pyo6ZuA5Zyj', '0', null, '1', '0', '1000', '21', null, '');
