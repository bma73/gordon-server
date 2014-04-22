var server = require('../server.js');
var Session = require('./session');
var User = require('./user');
var logger = require('../util/logger');


var sessions = {};
var userIds = [];
var users = {};
var userCount = 0;
var userTimeoutInterval = 1000;
var checkUserIntervalId = -1;

exports.setMaxUsers = function (count, add) {

    if (!add) userIds = [];
    for (var i = 1; i <= count; i++) {
        userIds.push(i);
    }
};

exports.getUserIdsLeft = function(){
    return userIds.length;
};

exports.createSession = function (id, name, data) {
    id = String(id);
    if (sessions[id] != null) {
        throw new Error('Session with id ' + id + 'already exists.');
    }
    var session = new Session(id, name, data);
    sessions[session.id] = session;
    return session;
};

exports.getSession = function (id) {
    return sessions[id];
};

exports.disposeSession = function (id) {
    var session = sessions[id];
    session.dispose();
    sessions[id] = null;
    delete sessions[id];
};

exports.createUser = function (sessionId, roomId, connection, name, dataObject) {
    var session = sessions[sessionId];
    var room = session.getRoom(roomId);

    if (userIds.length == 0) {
        logger.warn('Server is full.');
        return 0;
    }

    if (!room) {
        logger.warn('Room "%s" not found.', roomId);
        return 1;
    }

    if (room.isFull()) {
        logger.warn('Room "%s" is full.', roomId);
        return 1;
    }

    var id = userIds.shift();
    var user = new User(id);
    user.connection = connection;
    user.name = name;
    user.dataObject = dataObject;
    if (dataObject) dataObject.user = user;

    session.addUser(user);
    room.addUser(user);

    users[user.id] = user;
    room.users[user.id] = user;
    userCount++;

    logger.info('User "%s"(%d) created in "%s/%s".', name, id, sessionId, roomId);

    return user;
};

exports.getUser = function (userId) {
    return users[userId];
};

exports.disposeUser = function (user) {

    logger.info('User "%s"(%d) removed from "%s/%s".', user.name, user.id, user.session.id, user.room.id);
    users[user.id] = null;
    delete users[user.id];
    userIds.push(user.id);
    userCount--;

    user.session.removeUser(user);
    user.room.removeUser(user);
    user.dispose();
};

exports.getSessionListAsJSON = function () {
    var ret = [];
    for (var i in sessions){
        ret.push(sessions[i]);
    }
    return JSON.stringify(ret);
};

exports.sessions = sessions;


var checkRoomIntervalId = setInterval(function () {
    for (var s in sessions) {
        var session = sessions[s];
        for (var i in s.nonPersistentRooms) {
            var room = s.nonPersistentRooms[i];
            if (room.id == -1) continue;

            if (room.userCount == 0) {
                s.removeRoom(room.id);
            }
        }
    }
}, 2000);


exports.initUserTimeOutCheck = function (interval) {
    clearInterval(userTimeoutInterval);
    userTimeoutInterval = setInterval(function () {
        for (var s in sessions) {
            var session = sessions[s];
            for (var i in session.users) {
                var user = session.users[i];
                if (user.id == -1) continue;
                if (user.connection == null) continue;
                if (Date.now() > user.lastPingTime + interval) {
                    user.connection.dispose();
                }
            }
        }
    }, interval * 0.5);
};


