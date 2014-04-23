/**
 * @module gordon
 */


/**
 * A session can be divided in any number of rooms. Rooms are where the clients communicate.
 * Every room is limited to a maximum number of clients.
 *
 * @class Room
 */

var util = require('util');
var events = require('events');
var dataObject = require('./data-object');
var core = require('../core/protocol');
var User = require('./user');
var Event = require('../event/room');
var logger = require('../util/logger');


function Room(id, options, data) {
    options = options || {};
    /**
     * The room UUID.
     * @property id
     * @type String
     **/
    this.id = id;
    this.users = {};
    /**
     * The password for this room. If empty there's no password.
     * @property password
     * @type String
     * @default ''
     **/
    this.password = options.password || '';

    /**
     * The room name.
     * @property name
     * @type String
     **/
    this.name = options.name || 'Room';

    /**
     * The max number of users for this room.
     * @property maxUsers
     * @type Number
     * @default 50
     **/
    this.maxUsers = options.maxUsers || 50;

    /**
     * If set to true this room won't be removed automatically after 2 secs if emtpy.
     * @property persistent
     * @type Boolean
     **/
    this.persistent = options.persistent || false;

    /**
     * The number of users.
     * @property userCount
     * @type Number
     **/
    this.userCount = 0;
    this.dataObjects = {};

    /**
     * The master user of this room.
     * Every room has one dedicated master user. The master changes automatically
     * if the current master user left the room.
     * @property master
     * @type User
     **/
    this.master = null;

    /**
     * The session the room belongs to.
     * @property session
     * @type Session
     **/
    this.session = null;

    /**
     * The custom logic attached to this room.
     * See the examples for use cases.
     *
     * <pre>
     *  var Gamelogic = require('./gamelogic');
     *
     *  var session = gordon.createSession('session1', 'Session with custom logic');
     *  var lobby = session.createRoom('lobby');
     *
     *  //create the logic module and attach it the room
     *  lobby.logic = new Gamelogic(lobby);
     * </pre>
     *
     * The logic object could also define the following methods to modify
     * the standard protocol flow:
     *
     * <pre>
     * joinLogic(user, proceed)
     * changeRoomLogic(user, newRoom, oldRoom, proceed)
     * chatMessageLogic(target, message, proceed)
     * customMessageLogic(buffer, proceed)
     * </pre>
     *
     * Call the passed in proceed function to continue with the
     * standard protocol flow.
     *
     * <pre>
     *    this.changeRoomLogic = function (user, newRoom, oldRoom, proceed) {
     *      //don't allow users to change to room3
     *      if (newRoom.id == 'room3') {
     *           proceed(false);
     *      } else {
     *          proceed(true);
     *      }
     *    };
     * </pre>
     *
     * @property logic
     * @type Object
     **/
    this.logic = null;
    this.data = data || {};
    logger.info('Room "%s" created.', id);
}

util.inherits(Room, events.EventEmitter);

Room.prototype.toJSON = function () {
    var obj = {
        id: this.id,
        maxUsers: this.maxUsers,
        persistent: this.persistent,
        hasPassword: this.password != '',
        userCount: this.userCount,
        data: this.data,
        // users:this.users,
        name: this.name

    };
    return obj;
};

Room.prototype.isFull = function () {
    return this.maxUsers == this.userCount;
};

Room.prototype._addDataObject = function (dataObject) {
    this.dataObjects[dataObject.id] = dataObject;
    dataObject.room = this;
};


/**
 * Creates a {{#crossLink "DataObject"}}{{/crossLink}} in this room.
 *
 * @method createDataObject
 * @param {Object} values An object with key/values. The keys must be unique integers. The values must be binary.
 * @param {Boolean} [broadcast] If true the creation will be broadcast to all users in the room.
 * @returns {DataObject} The freshly created dataObject.
 *
 * @example
 * <pre>
 *  //define the dataobject structure
 *  var values = {};
 *  values[0] = new Buffer(1);
 *  values[1] = new Buffer(2);
 *  values[2] = new Buffer(2);
 *  values[3] = new Buffer(1);
 *  values[4] = new Buffer(4);
 *
 *  this.active = Rnd.boolean();
 *
 *  //write the initial values
 *  values[0].writeInt8(1, 0);
 *  values[1].writeInt16BE(900, 0);
 *  values[2].writeInt16BE(500, 0);
 *  values[3].writeInt8(false, 0);
 *  values[4].writeInt32BE(0xff0000, 0);
 *
 *  //create and broadcast the dataObject
 *  this.dataObject = this.room.createDataObject(values, true);
 * </pre>
 */
Room.prototype.createDataObject = function (values, broadcast) {
    var object = dataObject.createObject(values);
    this._addDataObject(object);
    if (broadcast) core.outMessageHandlers.updateDataObject(this.users, object.id, null, []);
    return object;
};

Room.prototype._removeDataObject = function (object) {
    if (this.dataObjects == null) return;
    if (object == null) return;
    delete this.dataObjects[object.id];
};

Room.prototype.getDataObject = function (id) {
    return this.dataObjects[id];
};


Room.prototype.addUser = function (user) {
    user.room = this;
    this.users[user.id] = user;
    this.userCount++;
};

Room.prototype.getUser = function (id) {
    return this.users[id];
};

Room.prototype.removeUser = function (user) {
    user.room = null;
    delete this.users[user.id];
    this.userCount--;
};

Room.prototype._findNewMaster = function () {
    if (this.userCount == 0) return null;
    for (var i in this.users) {
        var user = this.users[i];
        if (user === this.master) continue;
        user.master = true;
        this.master = user;
        return user;
    }
};



Room.prototype.dispose = function () {
    for (var i in this.dataObjects) {
        this.dataObjects[i].dispose();
    }

    if (this.logic != null && this.logic.dispose != null) this.logic.dispose();
    this.logic = null;
    this.master = null;
    this.dataObjects = null;
    this.session = null;
    this.id = -1;
    this.users = null;
    this.userCount = -1;
    this.emit(Event.DISPOSE, this);

    this.removeAllListeners(Event.DISPOSE);
    this.removeAllListeners(Event.ADD_USER);
    this.removeAllListeners(Event.REMOVE_USER);
};

module.exports = Room;



