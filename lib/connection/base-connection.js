var core = require('../core/protocol.js');
var server = require('../server');
var connectionPool = require('../core/connection-pool.js');

function BaseConnection(id, socket){
    this.buffer = new Buffer(server.config.connectionBufferSize);
    this.bufferLength = 0;
    this.bufferPosition = 0;
    this.id = id;
    this.socket = socket;
    this.user = null;
    this._disposed = false;
    this._closeable = false;
    this.messageHandler = core.handleMessage;
}

BaseConnection.prototype.dispose = function () {
    core.handleUserDisconnect(this);
    connectionPool.deleteConnection(this);
    this.user = null;
    this.id = -1;
    this.messageHandler = null;
    this._disposed = true;
};

module.exports = BaseConnection;

