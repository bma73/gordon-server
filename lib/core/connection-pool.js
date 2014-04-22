var core = require('../core/protocol.js');
var TcpConnection = require('../connection/tcp-connection.js');
var WebSocketConnection = require('../connection/websocket-connection.js');
var logger = require('../util/logger');

var pool = {};
var count = 0;
var id = 0;

var close = function (connection) {
    core.handleUserDisconnect(connection);
    delete pool[connection.socket];

    connection.socket.end();
    connection.socket.destroy();
    connection.socket = null;
    connection.user = null;
    connection.messageHandler = null;
    logger.info('Connection closed', connection.id);
    count--;
}

exports.deleteConnection = function (connection) {
    delete pool[connection.socket];
    count--;
}


exports.addTCPSocketConnection = function (socket) {
    var connection = new TcpConnection(socket, id++);
    pool[socket] = connection;
    count++;
    logger.info('new tcp connection', socket.remoteAddress);
}

exports.addWebSocketConnection = function (connection) {
    var webSocketConnection = new WebSocketConnection(connection, id++);
    pool[webSocketConnection.socket] = webSocketConnection;
    count++;
    logger.info('new websocket connection', webSocketConnection.socket.remoteAddress);

}

exports.getConnectionCount = function () {
    return count;
}