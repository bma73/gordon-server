/**
 * @module gordon-server
 */


/**
 * The session is the highest object in the Gordon hierarchy.
 * Every session is completely independent from other sessions.
 * Sessions can have {{#crossLink "Room"}}rooms{{/crossLink}}.
 *
 * @class Session
 */

var Room = require('./room');
var logger = require('../util/logger');

function Session(id, name, data) {

    /**
     * The session UUID.
     * @property id
     * @type String
     **/
    this.id = id;
    this.rooms = {};
    /**
     * The number  of rooms.
     * @property roomCount
     * @type Number
     **/
    this.roomCount = 0;

    /**
     * The number  of users.
     * @property userCount
     * @type Number
     **/
    this.userCount = 0;

    /**
     * The session name.
     * @property name
     * @type String
     **/
    this.name = name == null ? 'Session' + id : name;
    this.users = {};
    this._roomId = 0;
    this.data = data || {};

    /**
     * The logic factory assigned to this session.
     * The assigned function is called when a room has been created internally.
     * This could be used to modify the room's properties or e.g. attach a custom
     * room logic accordingly by returning a 'room logic object'. See {{#crossLink "Room/logic:property"}}room logic{{/crossLink}}
     * for more infos.
     *
     *
     * @example
     * <pre>
     *  var Gamelogic = require('./gamelogic');
     *
     *  session.logicFactory = function (room) {
     *   var gamelogic;
     *
     *   if (room.id == 'room1') {
     *       gamelogic = new Gamelogic(room, 0x800080);
     *       //by default rooms will be removed automatically after 2 sec if empty
     *       //setting the persistent flag to true will prevent this
     *       room.persistent = true;
     *       return gamelogic;
     *   }
     *
     *   if (room.id == 'room2') {
     *       gamelogic = new Gamelogic(room, 0xFF8000);
     *       room.persistent = true;
     *       return gamelogic;
     *   }
     *
     *   if (room.id == 'room3') {
     *       gamelogic = new Gamelogic(room, 0x80FF00);
     *       room.persistent = true;
     *       return gamelogic;
     *   }
     *};
     * </pre>
     * @property logicFactory
     * @type Function
     * @default null
     **/
    this.logicFactory = null;
    this.nonPersistentRooms = {};

    /**
     * If autoRoomCreate is set to true and a user wants to join into a not yet
     * existing room, a room with the provided roomId will be created automatically.
     * @property autoRoomCreate
     * @type Boolean
     * @default false
     **/
    this.autoRoomCreate = false;
    logger.info('Session "%s" created', id);
};

Session.prototype.toJSON = function () {
    var obj = {
        rooms: this.rooms,
        id: this.id,
        userCount: this.userCount,
        name: this.name,
        data: this.data
    };
    return obj;
};

/**
 * Creates a room.
 *
 * @method createRoom
 * @param {String} roomUUID The session-wide unique room id.
 * @param {Object} [options] An options object.
 * @param {String} options.name The room name.
 * @param {Number} options.maxUsers The maximum number of users. Default is 50.
 * @param {Boolean} options.persistent If a room is non-persitent, it will be removed when empty. Default is false.
 * @param {String} options.password Sets a password for this room. Default is no password.
 * @param {Object} [data] Data that should be stored with the room.
 * @returns {Room} The freshly created room.
 */
Session.prototype.createRoom = function (roomUUID, options, data) {

    var room;
    if (roomUUID != -1){
        room = this.rooms[roomUUID];
        if (room){
            logger.warn('Room "%s" already exists', roomUUID);
            return room;
        }
    }

    room = new Room(roomUUID == -1 ? this._roomId++ : roomUUID, options, data);

    if (this.logicFactory) {
        room.logic = this.logicFactory(room);
    }

    this.rooms[room.id] = room;
    this.roomCount++;
    room.session = this;

    if (!room.persistent) {
        this.nonPersistentRooms[room.id] = room;
    }
    return room;
};

Session.prototype.removeRoom = function (roomUUID) {

    var room = this.rooms[roomUUID];
    if (room == null) return null;
    delete this.rooms[roomUUID];
    this.roomCount--;

    if (!room.persistent) {
        delete this.nonPersistentRooms[roomUUID];
    }
    room.dispose();
};

/**
 * Gets a room by its id.
 *
 * @method getRoom
 * @param {String} roomUUID The session-wide unique room id.
 * @returns {Room} The room instance.
 */
Session.prototype.getRoom = function (roomUUID) {
    var room = this.rooms[roomUUID];
    if (room == null && this.autoRoomCreate) return this.createRoom(roomUUID);
    return room;
};

Session.prototype.addUser = function (user) {
    user.session = this;
    this.users[user.id] = user;
    this.userCount++;
};

Session.prototype.removeUser = function (user) {
    user.session = null;
    delete this.users[user.id];
    this.userCount--;
};

Session.prototype._changeRoomOfUser = function (user, newRoomUUID) {
    var oldRoom = user.room;
    var newRoom = this.getRoom(newRoomUUID);
    oldRoom.removeUser(user);
    newRoom.addUser(user);
    return user;
};


Session.prototype.dispose = function () {

    for (var i in this.rooms) {
        this.rooms[i].dispose();
    }
    this.rooms = null;
    this.userCount = -1;
};

module.exports = Session;


