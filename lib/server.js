/**
 * Gordon server
 *
 * @module gordon
 */


/**
 * The Gordon Server
 *
 * <pre>
 *     var gordon = require('gordon');
 *     //max number of concurrent users for this instance are 1000
 *     gordon.setMaxUsers(1000);
 *     gordon.createTCPServer(9091);
 *     gordon.createWebSocketServer(9092);
 *     var session = gordon.createSession('session1', 'A session');
 *     var lobby = session.createRoom('lobby', {name:'lobby',
 *                                              maxUsers:200,
 *                                              persistent:true});
 *     var room1 = session.createRoom('room1', {name:'Room1',
 *                                              maxUsers:100,
 *                                              persistent:true,
 *                                              password:'top-secret'});
 * </pre>
 *
 * @class Server
 */

var net = require('net');
var http = require('http');
var WebSocketServer = require('websocket').server;
var connectionPool = require('./core/connection-pool');
var Timer = require('./util/timer');
var structure = require('./structure/structure');
var protocol = require('./core/protocol');
var fs = require('fs');

var logger = require('./util/logger');

var startTime = Date.now();
var timer = new Timer();
var config;

/**
 * Creates the given number of userIds. This also defines the max number of users
 * that could connect to this server instance.
 *
 * @method setMaxUsers
 * @param {Number} [amount] The number of ids. Default is 500.
 * @param {Boolean} [add] If true the new ids will be added, otherwise the existing ids will be cleared first. Default is false.
 */
function setMaxUsers(amount, add) {
    structure.setMaxUsers(amount || 500, add || false);
}

/**
 * Creates a session. There has to be at least one session per server instance.
 *
 * @method createSession
 * @param {String} sessionUUId The server-wide unique session id.
 * @param {String} [name] The session name.
 * @param {Object} [data] Data that should be stored with the session.
 * @returns {Session} A session instance.
 */
function createSession(sessionUUId, name, data) {
    return structure.createSession(sessionUUId, name, data);
}

/**
 * Sets the server configuration.
 *
 * @method configure
 * @param {String | Object} conf You could either pass an object or a filename pointing to a JSON file.
 * @example
 * The config file/object must have the following properties:
 * <pre>
 *     {
 *        "connectionTimeOut":20000,
 *        "connectionBufferSize": 1000,
 *        "flashPolicyFile": "&lt;cross-domain-policy&gt; &lt;allow-access-from domain='*' to-ports='*'/&gt; &lt;/cross-domain-policy&gt; "
 *     }
 * </pre>
 * <code>connectionTimeOut</code> Defines the time frame after which the server closes the connection to a client being inactive (sending no updates / ping).<br>
 * <code>connectionBufferSize</code> The max size of a single message in bytes.<br>
 * <code>flashPolicyFile</code> The socket policy xml file which is sent to a Flash/Air client.<br>
 */
function configure(conf) {
    if (typeof(conf) == 'string') {
        config = JSON.parse(fs.readFileSync(conf));
    }
    else {
        config = conf;
    }
    structure.initUserTimeOutCheck(config.connectionTimeOut);
}

/**
 * Creates a new TCP server. The TCP server also supports Flash sockets and sends the
 * "cross domain policy" file defined in the configuration accordingly.
 *
 * @method createTCPServer
 * @param {Number} port The port the server should listen.
 */
function createTCPServer(port) {
    var server = net.createServer();

    server.on('connection', function (socket) {
        logger.info('New TCP connection');
        connectionPool.addTCPSocketConnection(socket);
    });
    server.listen(port, function () {
        logger.info('TCP Server is listening on port ' + port);
    });
}

/**
 * Creates a new TCP server. The TCP server also supports Flash sockets and sends the
 * "cross domain policy" file defined in the configuration accordingly.
 *
 * @method createTCPServer
 * @param {Number} port The port the server should listen.
 */
function createTCPServer(port) {
    var server = net.createServer();

    server.on('connection', function (socket) {
        logger.info('New TCP connection');
        connectionPool.addTCPSocketConnection(socket);
    });
    server.listen(port, function () {
        logger.info('TCP Server is listening on port ' + port);
    });
}

/**
 * Creates a new websocket server.
 *
 * @method createWebSocketServer
 * @param {Number} port The port the server should listen.
 * @param {Array} [checkOrigins] A list of origins that should be checked.
 */
function createWebSocketServer(port, checkOrigins) {
    var server = http.createServer(function (request, response) {
        response.writeHead(404);
        response.end();
    });
    server.listen(port, function () {
        logger.info('WebSocket Server is listening on port ' + port);
    });

    var wsServer = new WebSocketServer({
        httpServer: server,
        autoAcceptConnections: false
    });

    wsServer.on('request', function (request) {
        if (checkOrigins && checkOrigins.length) {
            var index = checkOrigins.indexOf(request.origin);
            if (index == -1) {
                request.reject();
                return;
            }
        }
        var connection = request.accept('gordon-protocol', request.origin);
        logger.info('Websocket Connection accepted.');
        connectionPool.addWebSocketConnection(connection);
    });
}

/**
 * Gets the current milliseconds since server start.
 *
 * @method getCurrentMillis
 * @returns {Number} The milliseconds
 */
function getCurrentMillis() {
    return Date.now() - startTime;
}

configure(__dirname + '/config.json');

setMaxUsers();

exports.createTCPServer = createTCPServer;
exports.createWebSocketServer = createWebSocketServer;
exports.setMaxUsers = setMaxUsers;
exports.createSession = createSession;
exports.getCurrentMillis = getCurrentMillis;
exports.configure = configure;
exports.config = config;
exports.timer = timer;

exports.sendDataObjectUpdate = protocol.sendDataObjectUpdate;
exports.sendDeleteDataObject = protocol.sendDeleteDataObject;
exports.sendCustomMessage = protocol.sendCustomMessage;
exports.sendSystemMessage = protocol.sendSystemMessage;
exports.sendChatMessage = protocol.sendChatMessage;




