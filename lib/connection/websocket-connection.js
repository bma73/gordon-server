var util = require('util');
var core = require('../core/protocol.js');
var BaseConnection = require('./base-connection.js');
var logger = require('../util/logger');

function WebSocketConnection(webSocketConnection, id) {
    BaseConnection.call(this, id, webSocketConnection.socket);

    this.webSocketConnection = webSocketConnection;
    var that = this;

    webSocketConnection.on('message', function (message) {

        if (message.type === 'utf8') return;
        if (message.type === 'binary') {
            try {
                that.messageHandler(that, message.binaryData);
            } catch (err) {
                logger.warn('Protocol ' + err + ' ' + that.socket.remoteAddress);
                that.dispose();
            }
        }
    });
}

util.inherits(WebSocketConnection, BaseConnection);

WebSocketConnection.prototype.send = function (buffer) {
    if (this.webSocketConnection) this.webSocketConnection.sendBytes(buffer);
};

WebSocketConnection.prototype.dispose = function () {
    if (this._disposed) return;
    WebSocketConnection.super_.prototype.dispose.apply(this);
    this.webSocketConnection.close();
    this.webSocketConnection = null;
    this.socket = null;
};

module.exports = WebSocketConnection;


