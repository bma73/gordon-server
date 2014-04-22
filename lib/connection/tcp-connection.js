var util = require('util');
var core = require('../core/protocol.js');
var BaseConnection = require('../connection/base-connection.js');
var logger = require('../util/logger');

function TcpConnection(socket, id) {
    BaseConnection.call(this, id, socket);
    this.messageHandler = core.handlePolicyFile;
    var that = this;
    this.socket.on('data', function (buffer) {
        try {
            that.messageHandler(that, buffer);
        } catch (err) {
            logger.warn('Protocol ' + err + ' ' + that.socket.remoteAddress);
            that.dispose();
        }
    });

    this.socket.on('error', function (err) {
        logger.error('Socket error!', err);
    });

    this.socket.once('close', function (error) {
        if (that._closeable) {
            that.dispose();
        }
        else {
            that._closeable = true;
        }
    });
}

util.inherits(TcpConnection, BaseConnection);


TcpConnection.prototype.send = function (buffer) {
    if (this.socket && this.socket.writable) this.socket.write(buffer);
};

TcpConnection.prototype.dispose = function () {
    if (this._disposed) return;
    TcpConnection.super_.prototype.dispose.apply(this);
    this.socket.end();
    this.socket.destroy();
    this.socket = null;
};

module.exports = TcpConnection;

