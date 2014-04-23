/**
 * @module gordon-server
 */


/**
 * Every connected client is represented by an User instance.
 *
 * @class User
 */

function User(id, data) {
    /**
     * The user id.
     * @property id
     * @type Number
     **/
    this.id = id;

    /**
     * The current room.
     * @property room
     * @type Room
     **/
    this.room = null;

    /**
     * The user's session.
     * @property session
     * @type Session
     **/
    this.session = null;

    /**
     * The user's dataObject.
     * @property dataObject
     * @type DataObject
     **/
    this.dataObject = null;

    /**
     * The user's connection.
     * @property connection
     * @type TCPConnection or WebSocketConnection
     **/
    this.connection = null;

    /**
     * The last ping.
     * @property lastPingTime
     * @type Number
     **/
    this.lastPingTime = Date.now();
    this.data = data || {};

    /**
     * The user's name.
     * @property name
     * @type String
     **/
}



User.prototype.toJSON = function() {
    var obj = {
        id:this.id,
        name:this.name,
        room:this.room.id,
        dataObject:this.dataObject
    };
    return obj;
};

User.prototype.dispose = function(){
    this.id = -1;
    this.lastPingTime = -1;

    this.session = null;
    this.connection = null;
    if (this.dataObject != null){
        this.dataObject.dispose(false);
    }
    this.room = null;
    this.dataObject = null;
};


module.exports = User;

