var util = require('util');
var events = require('events');
var C = require('../core/consts.js');
var core = require('../core/protocol.js');
var DataObjectEvents = require('../event/data-object.js');

var idPool = [];
var nextId = 1;
var dataObjects = {};


function getId() {
    if (idPool.length == 0) return nextId++;
    return idPool.shift();
}

function createObject(values) {
    var object = new DataObject(values);
    return object;
}

function deleteObject(id) {
    dataObjects[id].dispose();
}

function getObject(id) {
    return dataObjects[id];
}

/**
 * @module gordon
 */

/**
 * DataObject are used to synchronize states between the connected clients.
 * DataObjects live inside a room.
 * Every DataObject consists of key/value pairs, where keys must be unique integers (per DataObject) and the values must
 * be a <a href="http://nodejs.org/api/buffer.html">Buffer</a>.
 *
 * Every {{#crossLink "User"}}{{/crossLink}} has his own DataObject. Additional DataObjects could be created by
 * a client or by the {{#crossLink "Room/createDataObject:method"}}server{{/crossLink}}.
 *
 * DataObject could be used to represent objects like e.g. bots, windows, laser shots, grenades,
 * barrels, text blocks, cars etc.
 *
 *
 *  <pre>
 *     var dataObject = user.dataObject;
 *     dataObject.getValue(DataKey.X_POS).writeInt16BE(500, 0);
 *     dataObject.getValue(DataKey.Y_POS).writeInt16BE(500, 0);
 *     dataObject.getValue(DataKey.NAME).write('John Doe Jr.');
 *
 *    //broadcast values to dataObject's room
 *    dataObject.broadcastValues([DataKey.X_POS, DataKey.Y_POS, DataKey.NAME]);
 *   </pre>
 *
 * @class DataObject
 */

function DataObject(values) {
    this._updatedKeys = [];
    this._keysToSend = [];
    /**
     * The id.
     * @property id
     * @type Number
     **/
    this.id = getId();
    /**
     * The room.
     * @property room
     * @type Room
     **/
    this.room = null;
    this.values = values == null ? {} : values;
    /**
     * The according user if this dataObject belongs to a user.
     * @property user
     * @type User
     * @default null
     **/
    this.user = null;

    this.userUpdatePolicy = C.UPDATE_POLICY_PRIVATE;
    dataObjects[this.id] = this;
}

util.inherits(DataObject, events.EventEmitter);

DataObject.prototype.toJSON = function () {
    var obj = {
        id:this.id,
        values:this.values
    };
    return obj;
};


/**
 * Gets the buffer for the provided key.
 *
 * @method getValue
 * @param {Number} key The key.
 * @returns {<a href="http://nodejs.org/api/buffer.html">Buffer</a>} The buffer.
 */
DataObject.prototype.getValue = function (key) {
    var value = this.values[key];
    if (!value) throw new Error("Key doesn't exist.");
    return value;
};

/**
 * Broadcasts the values of the given keys to the users in the dataObject's room.
 *
 * @method broadcastValues
 * @param {Array} keys An array with keys.
 *
 * @example
 * <pre>
 *     //broadcast the values of the keys 0, 4 and 12
 *     dataObject.broadcastValues([0, 4, 12]);
 * </pre>
 */
DataObject.prototype.broadcastValues = function (keys) {
    this._updatedKeys = keys;
    var users = this.room ? this.room.users : this.user.room.users;
    core.outMessageHandlers.updateDataObject(users, this.id, !this.user ? null : [this.user], keys );
};

/**
 * Broadcasts all values of all keys to the users in the dataObject's room.
 *
 * @method broadcastAllValues
 */
DataObject.prototype.broadcastAllValues = function (room) {
    core.outMessageHandlers.updateDataObject(room == null ? this.room.users : room.users, this.id, null, [] );
};

DataObject.prototype.getBufferSize = function (keys) {
    var l = 2; //objectId
    if (keys == null || keys.length == 0) {
        for (var i in this.values) {
            l += 2; //keyid
            l += 4;
            l += this.values[i].length; //value
        }
    } else {
        for (i in keys){
            l += 2; //keyid
            l += 4;
            l += this.values[keys[i]].length; //value
        }
    }
    return l;
};

DataObject.prototype.dispose = function (broadcast) {
    if (this.room == null) return;

    this.emit(DataObjectEvents.DISPOSE);

    if (broadcast) core.outMessageHandlers.deleteDataObject(this.room.users, this.id);

    this.room._removeDataObject(this);
    this.values = null;
    this.user = null;
    this.room = null;
    idPool.push(this.id); //recycle ID
    delete dataObjects[this.id];

    this.id = -1;
    this.removeAllListeners(DataObjectEvents.DISPOSE);
    this.removeAllListeners(DataObjectEvents.UPDATE);
};



exports.dataObjects = dataObjects;
exports.createObject = createObject;
exports.deleteObject = deleteObject;
exports.getObject = getObject;
