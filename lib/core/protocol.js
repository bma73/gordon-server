var structure = require('../structure/structure.js');
var C = require('./consts.js');
var dataObject = require('../structure/data-object.js');
var server = require('../server');

var RoomEvent = require('../event/room');
var DataObjectEvent = require('../event/data-object');

var logger = require('../util/logger');

var messages = [];
messages[C.MESSAGE_JOIN] = in_join;
messages[C.MESSAGE_CHANGE_ROOM] = in_changeRoom;
messages[C.MESSAGE_DATA_OBJECT_UPDATE] = in_updateDataObject;
messages[C.MESSAGE_DATA_OBJECT_DELETE] = in_deleteDataObject;
messages[C.MESSAGE_INIT_DATA_OBJECT] = in_initDataObject;
messages[C.MESSAGE_GET_SESSION_LIST] = in_getSessionList;
messages[C.MESSAGE_GET_ROOM_LIST] = in_getRoomList;
messages[C.MESSAGE_GET_USER_LIST] = in_getUserList;
messages[C.MESSAGE_CUSTOM_MESSAGE] = in_customMessage;
messages[C.MESSAGE_CHAT_MESSAGE] = in_chatMessage;
messages[C.MESSAGE_PING] = in_ping;

var messages_out = {
    updateDataObject: out_dataObjectUpdate,
    deleteDataObject: out_deleteDataObject,
    sendCustomMessage: out_customMessage
};

//********************************************************
//* In                                                  *
//********************************************************

function in_join(connection, buffer) {

    var offset = 1;
    var sessionIdLength = buffer.readUInt16BE(offset);
    offset += 2;
    var sessionId = buffer.toString('utf8', offset, offset + sessionIdLength);
    offset += sessionIdLength;

    var roomIdLength = buffer.readUInt16BE(offset);
    offset += 2;
    var roomId = buffer.toString('utf8', offset, offset + roomIdLength);
    offset += roomIdLength;

    var nameLength = buffer.readInt8(offset);
    offset += 1;
    var name = buffer.toString('utf8', offset, offset + nameLength);
    offset += nameLength;

    console.log('in_join', sessionId, roomId);

    var session = structure.getSession(sessionId);
    if (session == null) {
        out_joinError(C.ERROR_SESSION_DOES_NOT_EXIST, connection);
        return;
    }
    var room = session.getRoom(roomId);
    if (room == null) {
        out_joinError(C.ERROR_ROOM_DOES_NOT_EXIST, connection);
        return;
    }

    if (structure.getUserIdsLeft() == 0) {
        out_joinError(user, connection);
        return;
    }
    var room = session.getRoom(roomId);
    if (!room || room.isFull()) {
        out_joinError(user, connection);
        return;
    }

    var user = structure.createUser(sessionId, roomId, connection, name);
    if (user == C.ERROR_ROOM_FULL || user == C.ERROR_SERVER_FULL) {
        //Error
        out_joinError(user, connection);
        structure.disposeUser(user);
        return;
    }

    //parse DataObject
    //ignore id
    offset += 2;
    var object = dataObject.createObject();
    object.user = user;
    updateDataObject(object, buffer, offset);
    user.dataObject = object;

    (room.logic && room.logic.joinLogic) ? room.logic.joinLogic(user, proceed) : proceed(true);

    function proceed(value) {
        if (value) {

            //check for master
            if (room.master == null) {
                room.master = user;
                out_setAsMaster(user);
            }

            connection.user = user;

            out_joinOk(user);

            user.room.emit(RoomEvent.ADD_USER, user);

            out_newUsers(user, room);

            out_newDataObjects(user);
            out_dataObjectsSent(user);
            out_newUser(room.users, user);
        }
        else {
            out_joinError(C.ERROR_MISC, connection);
            structure.disposeUser(user);
        }
    }
};

function in_changeRoom(connection, buffer) {

    if (!connection.user) throw new Error('ChangeRoom: not joined');

    var user = connection.user;

    var oldRoom = user.room;
    var oldRoomId = user.room.id;
    var offset = 1;

    var newRoomIdLength = buffer.readUInt16BE(offset);
    offset += 2;
    var newRoomId = buffer.toString('utf8', offset, offset + newRoomIdLength);

    if (newRoomId == user.room.id) {
        out_changeRoomError(user, C.ERROR_SAME_ROOM);
        return;
    }

    offset += newRoomIdLength;

    var passwordLength = buffer.readUInt16BE(offset);
    offset += 2;
    var password = buffer.toString('utf8', offset, offset + passwordLength);
    offset += passwordLength;

    updateDataObject(user.dataObject, buffer, offset + 2);

    var newRoom = user.session.getRoom(newRoomId);

    if (newRoom == null) {
        //error room does not exist
        out_changeRoomError(user, C.ERROR_ROOM_DOES_NOT_EXIST);
        return;
    } else if (newRoom.maxUsers == newRoom.userCount) {
        //error new room full
        out_changeRoomError(user, C.ERROR_ROOM_FULL);
        return;
    } else if (newRoom.password !== '' && newRoom.password !== password) {
        //error wrong password
        out_changeRoomError(user, C.ERROR_WRONG_PASSWORD);
        return;
    }

    (oldRoom.logic && oldRoom.logic.changeRoomLogic) ? oldRoom.logic.changeRoomLogic(user, newRoom, oldRoom, proceed) : proceed(true);

    function proceed(value) {
        if (value) {

            //send remove message to users in old room
            out_userLeft(oldRoom.users, user);

            //OK!
            user.session._changeRoomOfUser(user, newRoomId);

            //check if user has been master
            var masterUser;
            if (user.master) {
                //find new master for old room
                masterUser = oldRoom._findNewMaster();
                if (masterUser != null) {
                    out_setAsMaster(masterUser);
                }
            }

            //send remove users of old room to user
            for (var i in oldRoom.users) {
                if (oldRoom.users[i] === user) continue;
                out_userLeft(user, oldRoom.users[i]);
            }

            //send ok message
            out_removeDataObjects(user, oldRoom);
            out_changeRoomOk(user, newRoomId);

            //check for master in new room
            if (newRoom.master == null) {
                newRoom.master = user;
                out_setAsMaster(user);
            }

            out_newUsers(user, newRoom);
            out_newDataObjects(user);
            out_dataObjectsSent(user);

            //send new message to users in new room
            out_newUser(newRoom.users, user);

            newRoom.emit(RoomEvent.ADD_USER, user);
            oldRoom.emit(RoomEvent.REMOVE_USER, user);
        } else {
            out_changeRoomError(user, C.ERROR_MISC);
        }
    }
}


function in_getSessionList(connection, buffer) {
    var callbackId = buffer.readUInt16BE(1);
    var list = structure.getSessionListAsJSON();
    sendMessageToConnection(createListMessage(callbackId, list, C.MESSAGE_GET_SESSION_LIST), connection);
}

function in_getRoomList(connection, buffer) {
    var offset = 1;
    var callbackId = buffer.readUInt16BE(offset);
    offset += 2;
    var sessionIdLength = buffer.readUInt16BE(offset);
    offset += 2;
    var sessionId = buffer.toString('utf8', offset, offset + sessionIdLength);
    var session = structure.getSession(sessionId);
    if (!session) {
        logger.warn('Session "' + sessionId + '" not found.');
        var list = '[]';
    } else {
        var ret = [];
        for (var i in session.rooms) {
            ret.push(session.rooms[i]);
        }
        list = JSON.stringify(ret);
    }
    sendMessageToConnection(createListMessage(callbackId, list, C.MESSAGE_GET_ROOM_LIST), connection);
}

function in_getUserList(connection, buffer) {
    var offset = 1;
    var callbackId = buffer.readUInt16BE(offset);
    offset += 2;

    var sessionIdLength = buffer.readUInt16BE(offset);
    offset += 2;
    var sessionId = buffer.toString('utf8', offset, offset + sessionIdLength);
    offset += sessionIdLength;

    var roomIdLength = buffer.readUInt16BE(offset);
    offset += 2;
    var roomId = buffer.toString('utf8', offset, offset + roomIdLength);

    var session = structure.getSession(sessionId);
    if (!session) {
        logger.warn('Session "' + sessionId + '" not found.');
        var list = '[]';
    } else {
        var room = session.getRoom(roomId);
        if (!room) {
            logger.warn('Room "' + roomId + '" not found.');
            list = '[]';
        } else {
            var ret = [];
            for (var i in room.users) {
                ret.push(room.users[i]);
            }
            list = JSON.stringify(ret);
        }
    }
    sendMessageToConnection(createListMessage(callbackId, list, C.MESSAGE_GET_USER_LIST), connection);
}

function in_chatMessage(connection, buffer) {
    if (!connection.user) throw new Error('ChatMessage: not joined');

    var targetId = buffer.readUInt16BE(1);
    var message = buffer.toString('utf8', 3);

    var room = connection.user.room;
    if (room == null) return;

    if (targetId != 0) {
        var targetUser = connection.user.room.getUser(targetId);
        if (targetUser == null) return;
    }

    (room.logic && room.logic.chatMessageLogic) ? room.logic.chatMessageLogic(targetId == 0 ? room.users : targetUser, message, proceed) : proceed(true);

    function proceed(value, modMessage) {
        if (value) {
            modMessage = modMessage || message;
            if (targetId == 0) {
                room.emit(RoomEvent.CHAT_MESSAGE, modMessage, connection.user, room.users);
                out_chatMessage(room.users, connection.user, modMessage);
            }
            else {
                room.emit(RoomEvent.CHAT_MESSAGE, modMessage, connection.user, targetUser);
                out_chatMessage(targetUser, connection.user, modMessage);
            }
        }
    }
}

function in_customMessage(connection, buffer) {
    if (!connection.user) throw new Error('CustomMessage: not joined');

    var room = connection.user.room;
    if (!room) return;

    buffer = buffer.slice(1);

    connection.user.room.emit(RoomEvent.CUSTOM_MESSAGE, connection, buffer);

    (room.logic && room.logic.customMessageLogic) ? room.logic.customMessageLogic(buffer, proceed) : proceed(true, buffer);

    function proceed(value, buffer) {
        if (value) {
            out_customMessage(buffer, connection.user.room.users);
        }
    }
}

function in_ping(connection, buffer) {
    if (!connection.user) throw new Error('Ping: not joined');
    var user = connection.user;
    user.lastPingTime = Date.now();
    out_ping(user);
}


function in_deleteDataObject(connection, buffer) {

    if (!connection.user) throw new Error('DeleteDataObject: not joined');

    var user = connection.user;
    var id = buffer.readUInt16BE(1);
    var broadcast = buffer.readInt8(3);

    var object = dataObject.getObject(id);
    if (object == null) {
        return;
    }

    if (broadcast == 1) {
        out_deleteDataObject(object.room.users, id);
    }
    user.room.emit(RoomEvent.DATA_OBJECT_DISPOSED, object);
    object.dispose();
}

function in_initDataObject(connection, buffer) {

    if (!connection.user) throw new Error('InitDataObject: not joined');

    var user = connection.user;
    var offset = 1;
    var policy = buffer.readUInt8(offset);
    offset++;
    var callbackId = buffer.readUInt16BE(offset);
    offset += 2;
    var id = buffer.readUInt16BE(offset);
    offset += 2;

    var object = dataObject.createObject();
    object.userUpdatePolicy = policy;
    user.room._addDataObject(object);
    out_dataObjectCreated(user, callbackId, object.id);
    id = object.id;

    var keys = updateDataObject(object, buffer, offset);
    object.updatedKeys = keys;

    out_dataObjectUpdate(user.room.users, id, [user], []);
    user.room.emit(RoomEvent.NEW_DATA_OBJECT, object);
}

function in_updateDataObject(connection, buffer) {

    if (!connection.user) throw new Error('UpdateDataObject: not joined');

    var keyId, valueLength, value;
    var offset = 1;
    var updatedKeyIds = [];
    var bufferLength = buffer.length;

    var user = connection.user;

    var broadcast = buffer.readInt8(offset);
    offset += 1;

    var id = buffer.readUInt16BE(offset);
    offset += 2;

    var object = dataObject.getObject(id);
    if (object == null) return;

    //user updates server created dataObject
    if (object.user == null && object.userUpdatePolicy == C.UPDATE_POLICY_PRIVATE) return;
    if (object.user != null) {
        if (object.user !== user && object.userUpdatePolicy == C.UPDATE_POLICY_PRIVATE) return;
    }
    var keys = updateDataObject(object, buffer, offset);
    object.updatedKeys = keys;

    if (broadcast) {
        out_dataObjectUpdate(user.room.users, id, [user], keys);
    }
    object.emit(DataObjectEvent.UPDATE, object);
}

function updateDataObject(dataObject, buffer, offset) {

    dataObject._updatedKeys.length = 0;
    var bufferLength = buffer.length;
    var values = dataObject.values;

    var keys = [];

    if (bufferLength <= offset) return keys;

    while (true) {
        var keyId = buffer.readUInt16BE(offset);
        dataObject._updatedKeys.push(keyId);
        keys.push(keyId);
        offset += 2;


        var valueLength = buffer.readUInt32BE(offset);
        offset += 4;

        var value = values[keyId];
        if (value == null) {
            value = new Buffer(valueLength);
            values[keyId] = value;
        }
        else if (value.length != valueLength) {
            value = new Buffer(valueLength);
        }
        buffer.copy(value, 0, offset, offset + valueLength);

        offset += valueLength;
        if (offset >= bufferLength) break;
    }
    return keys;
}


//********************************************************
//* Out                                                  *
//********************************************************

function out_dataObjectCreated(target, callbackId, objectId) {
    var out = new Buffer(1 + 2 + 2);
    out.writeInt8(C.MESSAGE_DATA_OBJECT_CREATED, 0);
    out.writeInt16BE(callbackId, 1);
    out.writeInt16BE(objectId, 3);
    sendMessage(out, target);
}

function out_ping(target) {
    var out = new Buffer(1);
    out.writeInt8(C.MESSAGE_PING, 0);
    sendMessage(out, target);
}

function out_dataObjectsSent(target) {
    var out = new Buffer(1);
    out.writeInt8(C.MESSAGE_DATA_OBJECTS_SENT, 0);
    sendMessage(out, target);
}


function out_dataObjectUpdate(target, dataObjectId, exclude, keys) {
    /*
     0 messageId     (byte)
     1 policy        (byte)
     2 objectId      (int16)

     4 keyId         (int16)
     6 valueLength   (int32)
     10 value         (byteArray)
     ..
     ..
     */

    var object = dataObject.getObject(dataObjectId);
    if (object == null) {
        logger.warn('Update Data Object ' + dataObjectId + 'not found.');
        return;
    }

    var out = new Buffer(1 + 1 + object.getBufferSize(keys));

    var offset = 0;
    out.writeInt8(C.MESSAGE_DATA_OBJECT_UPDATE, offset);
    offset += 1;
    out.writeInt8(object.userUpdatePolicy, offset);
    offset += 1;
    out.writeInt16BE(dataObjectId, offset);
    offset += 2;

    //key/values
    var values = object.values;
    var value;
    if (keys.length == 0) {

        for (var i in values) {
            out.writeInt16BE(Number(i), offset);
            offset += 2;
            value = values[i];
            out.writeUInt32BE(value.length, offset);
            offset += 4;
            value.copy(out, offset);
            offset += value.length;
        }
    }
    else {
        keys = object._updatedKeys;
        var l = keys.length;

        for (var n = 0; n < l; n++) {
            var key = Number(keys[n]);
            out.writeInt16BE(key, offset);
            offset += 2;
            value = values[key];
            out.writeUInt32BE(value.length, offset);
            offset += 4;
            value.copy(out, offset);
            offset += value.length;
        }
    }

    object._updatedKeys.length = 0;
    sendMessage(out, target, exclude);
}


function out_newDataObjects(user) {
    var room = user.room;
    var dataObjects = room.dataObjects;
    for (var i in dataObjects) {
        out_dataObjectUpdate(user, dataObjects[i].id, null, []);
    }
}

function out_userLeft(target, user) {
    var out = new Buffer(1 + 2 + 2 + 2 + user.room.id.length + user.session.id.length);
    var offset = 0;
    out.writeInt8(C.MESSAGE_USER_LEFT, offset);
    offset++;

    out.writeInt16BE(user.id, offset);
    offset += 2;

    var sessionIdLength = user.session.id.length;
    out.writeInt16BE(sessionIdLength, offset);
    offset += 2;
    out.write(user.session.id, offset, offset + sessionIdLength);
    offset += sessionIdLength;

    var roomIdLength = user.room.id.length;
    out.writeInt16BE(roomIdLength, offset);
    offset += 2;
    out.write(user.room.id, offset, offset + roomIdLength);
    offset += roomIdLength;

    sendMessage(out, target, [user]);
}

function out_removeDataObjects(user, room) {
    for (var i in room.dataObjects) {
        var dataObject = room.dataObjects[i];
        out_deleteDataObject(user, dataObject.id);
    }
}

function out_deleteDataObject(target, dataObjectId) {
    var out = new Buffer(1 + 2);
    out.writeInt8(C.MESSAGE_DATA_OBJECT_DELETE, 0);
    out.writeInt16BE(dataObjectId, 1);
    sendMessage(out, target);
}


function out_joinOk(target) {

    var data = JSON.stringify(target.room.data);
    var out = new Buffer(1 + 2 + 2 + target.session.id.length + 2 + target.room.id.length + 2 + data.length + target.name.length + 2 + target.dataObject.getBufferSize());
    var offset = 0;
    out.writeInt8(C.MESSAGE_JOIN, offset);
    offset += 1;
    out.writeInt16BE(target.id, offset);
    offset += 2;

    var sessionIdLength = target.session.id.length;
    out.writeInt16BE(sessionIdLength, offset);
    offset += 2;
    out.write(target.session.id, offset, offset + sessionIdLength);
    offset += sessionIdLength;

    var roomIdLength = target.room.id.length;
    out.writeInt16BE(roomIdLength, offset);
    offset += 2;
    out.write(target.room.id, offset, offset + roomIdLength);
    offset += roomIdLength;

    out.writeInt16BE(data.length, offset);
    offset += 2;
    out.write(data, offset, offset + data.length);
    offset += data.length;

    out.writeInt16BE(target.dataObject.id, offset);
    offset += 2;

    var nameLength = target.name.length;
    out.writeInt16BE(nameLength, offset);
    offset += 2;
    out.write(target.name, offset, offset + nameLength);
    offset += nameLength;

    //key/values
    var values = target.dataObject.values;
    for (var i in values) {
        out.writeInt16BE(Number(i), offset); // key
        offset += 2;
        var value = values[i];
        out.writeUInt32BE(value.length, offset); //value length
        offset += 4;
        value.copy(out, offset); // value
        offset += value.length;
    }


    sendMessage(out, target);
}

function out_newUser(target, user) {
    var out = createNewUserMessagePayload(user);
    sendMessage(out, target, [user]);
}


function out_newUsers(user, room) {

    for (var i in room.users) {
        if (room.users[i] === user) continue;
        var out = createNewUserMessagePayload(room.users[i]);
        sendMessage(out, user);
    }
}

function out_joinError(errorCode, connection) {
    var out = new Buffer(2);
    out.writeInt8(C.MESSAGE_JOIN_ERROR, 0);
    out.writeInt8(errorCode, 1);
    sendMessageToConnection(out, connection);
}


function out_setAsMaster(target) {
    var out = new Buffer(1);
    out.writeInt8(C.MESSAGE_MASTER, 0);
    sendMessage(out, target);
}

function out_changeRoomError(target, errorCode) {
    var out = new Buffer(1 + 1);
    out.writeInt8(C.MESSAGE_CHANGE_ROOM_ERROR, 0);
    out.writeInt8(errorCode, 1);
    sendMessage(out, target);
}

function out_chatMessage(target, sender, message) {

    var out = new Buffer(1 + 2 + 2 + message.length);
    out.writeInt8(C.MESSAGE_CHAT_MESSAGE, 0);
    out.writeInt16BE(target.id || 0, 1);
    out.writeInt16BE(sender.id, 3);
    out.write(message, 5);
    sendMessage(out, target);
}

function out_systemMessage(params, message) {

    var out = new Buffer(1 + 2 + message.length);
    out.writeInt8(C.MESSAGE_CHAT_MESSAGE, 0);
    out.writeInt16BE(0, 1);
    out.write(message, 3);

    switch (params.routing) {
        case 'user':
            var user = structure.getUser(params.userId);
            if (!user) return;
            sendMessage(out, user);
            break;
        case 'room':
            var session = structure.getSession(params.sessionId);
            if (session == null) return;
            var room = session.getRoom(params.roomId);
            if (!room) return;
            sendMessage(out, room);
            break;
        case 'session':
            session = structure.getSession(params.sessionId);
            if (!session) return;
            var rooms = session.rooms;
            for (var i in rooms) {
                room = rooms[i];
                sendMessage(out, room);
            }
            break;
        case 'server':
            var sessions = structure.sessions;
            for (i in sessions) {
                session = sessions[i];
                rooms = session.rooms;
                for (var n in rooms) {
                    room = rooms[n];
                    sendMessage(out, room);
                }
            }
            break;

    }
    if (typeof(target) === 'number') {
        //single user
        user = structure.getUser(target);
        if (!user) return;
        sendMessage(out, target);
    } else if (target == '') {

    }

}

function out_changeRoomOk(target, roomId) {
    var out = new Buffer(1 + roomId.length);
    out.writeInt8(C.MESSAGE_CHANGE_ROOM, 0);
    out.write(roomId, 1);
    sendMessage(out, target);
}

function out_customMessage(buffer, target) {
    var out = new Buffer(1 + buffer.length);
    out.writeInt8(C.MESSAGE_CUSTOM_MESSAGE, 0);
    buffer.copy(out, 1);
    sendMessage(out, target);
}


//********************************************************
//* Helpers                                              *
//********************************************************

function createNewUserMessagePayload(user) {
    var out = new Buffer(1 + 2 + 2 + user.room.id.length + 2 + user.session.id.length + 1 + user.name.length + user.dataObject.getBufferSize());
    var offset = 0;
    out.writeInt8(C.MESSAGE_NEW_USER, offset);
    offset += 1;
    out.writeInt16BE(user.id, offset);
    offset += 2;

    var roomIdLength = user.room.id.length;
    out.writeInt16BE(roomIdLength, offset);
    offset += 2;
    out.write(user.room.id, offset, offset + roomIdLength);
    offset += roomIdLength;

    var sessionIdLength = user.session.id.length;
    out.writeInt16BE(sessionIdLength, offset);
    offset += 2;
    out.write(user.session.id, offset, offset + sessionIdLength);
    offset += sessionIdLength;

    var nameLength = user.name.length;
    out.writeInt8(nameLength, offset);
    offset += 1;
    out.write(user.name, offset, offset + nameLength);
    offset += nameLength;

    //dataObject
    out.writeInt16BE(user.dataObject.id, offset);
    offset += 2;

    //key/values
    var values = user.dataObject.values;
    for (var i in values) {
        out.writeInt16BE(Number(i), offset); // key
        offset += 2;
        var value = values[i];
        out.writeUInt32BE(value.length, offset); //value length
        offset += 4;
        value.copy(out, offset); // value
        offset += value.length;
    }
    return out;
}

function createListMessage(callbackId, list, messageId) {
    var out = new Buffer(1 + 2 + list.length);
    var offset = 0;
    out.writeInt8(messageId, offset);
    offset += 1;
    out.writeInt16BE(callbackId, offset);
    offset += 2;
    out.write(list, offset);
    return out;
}

function sendMessageToConnection(buffer, connection) {
    if (connection == null) return;
    var out = new Buffer(buffer.length + 4);
    out.writeUInt32BE(buffer.length, 0);
    buffer.copy(out, 4);
    connection.send(out);
}

function sendMessage(buffer, target, excludes) {

    //user list
    if (target.id == null) {
        for (var i in target) {
            var user = target[i];
            if (user == null) continue;
            if (excludes != null) {
                if (excludes.indexOf(user) != -1) continue;
            }
            sendMessageToConnection(buffer, user.connection);
        }
    }
    else {
        sendMessageToConnection(buffer, target.connection);
    }
}

//********************************************************
//* Exports                                              *
//********************************************************

exports.sendMessage = sendMessage;
exports.outMessageHandlers = messages_out;

exports.sendDataObjectUpdate = out_dataObjectUpdate;
exports.sendDeleteDataObject = out_deleteDataObject;
exports.sendCustomMessage = out_customMessage;
exports.sendSystemMessage = out_systemMessage;
exports.sendChatMessage = out_chatMessage;


exports.handlePolicyFile = function (connection, buffer) {
    if (buffer[0] == 60) {
        var xml = server.config.flashPolicyFile + '\0';
        connection.socket.write(xml);
    }
    else {
        connection._closeable = true;
        exports.handleMessage(connection, buffer);
    }
    connection.messageHandler = exports.handleMessage;
};

exports.handleMessage = function (connection, bytes) {

    bytes.copy(connection.buffer, connection.bufferLength, 0, bytes.length);
    connection.bufferLength += bytes.length;

    while (connection.bufferLength >= 4) {
        var messageLength = connection.buffer.readUInt32BE(0);

        if (connection.bufferLength - 4 >= messageLength) {

            var buffer = new Buffer(messageLength);
            connection.buffer.copy(buffer, 0, 4, 4 + messageLength);

            var length = connection.buffer.length - (messageLength + 4);

            connection.buffer.copy(connection.buffer, 0, 4 + messageLength);
            connection.bufferLength -= (4 + messageLength);

            if (connection.user) connection.user.lastPingTime = Date.now();
            var method = messages[buffer[0]];
            if (method) method(connection, buffer);
        }
    }
};

exports.handleUserDisconnect = function (connection) {
    var user = connection.user;

    //check for master
    if (user != null) {
        if (user.master) {
            //find new master for old room
            masterUser = user.room._findNewMaster();;
            if (!masterUser) out_setAsMaster(masterUser);
        }
        out_userLeft(user.room.users, user);
        user.room.emit('removeUser', user);
        structure.disposeUser(user);
    }
};




