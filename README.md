
![Gordon Server Logo][1]
Gordon Server
=============
Gordon is a lightweight server for developing multiuser apps and games with HTML5 and Adobe Flash/Air.
It uses a lean binary protocol to exchange data.

----------

### Install

With [npm](http://npmjs.org) do:
```
npm install gordon-server
```
See also [gordon-client][2] and [gordon-examples][3].

----------

### Structure
####Session
The session is the highest object in the Gordon hierarchy. Every session is completely independent from other sessions.
The session contains all other Gordon objects like rooms, users and dataObjects.
####Room
A session can be divided in any number of rooms. Rooms are where the clients interact.
Every room is limited to a maximum number of clients/users and can be optionally locked by a password.
####User
Every client connected to Gordon and joined to a session is represented as a User. Users can interact with each other by updating their dataObjects, sending chat or custom messages.
####DataObjects
DataObject are used to synchronize states between the connected clients.
DataObjects live inside a room.
Every dataObject consists of key/value pairs, where keys must be unique integers (per DataObject) and the values must be <a href="http://nodejs.org/api/buffer.html">Buffers</a>.
Every user has his own dataObject. Additional dataObjects could be created by a client or by the server.

DataObject could be used to represent objects like e.g. bots, windows, laser shots, grenades, barrels, text blocks, cars etc...

----------

###Usage
``` js
var gordon = require('gordon');

gordon.setMaxUsers(1000);
gordon.createTCPServer(9091);
gordon.createWebSocketServer(9092);

var session = gordon.createSession('session1', 'A Session');
var lobby = session.createRoom('lobby', {name:'Lobby',
                                         maxUsers:300,
                                         persistent:true });
                                         
var room1 = session.createRoom('room1', {name:'Locked Room',
                                         maxUsers:50,
                                         persistent:true,
                                         password:'top-secret'});
```

####Logic Factory
You could assign a ``logic factory`` to a session.
The assigned function is called when a room has been created internally.
This could be used to modify the room's properties or e.g. attach a custom room logic accordingly by returning a 'room logic object'. 
See ``room logic`` for more infos.


``` js
 var gordon = require('gordon');
 //require a custom logic class
 var Gamelogic = require('./gamelogic');

 gordon.setMaxUsers(1000);
 gordon.createTCPServer(9091);
 gordon.createWebSocketServer(9092);

 var session = gordon.createSession('session1', 'A Session');
 
 //The rooms will be created on the fly, when users want to join
 session.autoRoomCreate = true;

 session.logicFactory = function (room) {
  var gamelogic;

  //room ids containing "room_blue" shall be initialized in that way
  if (room.id.indexOf('room_blue') != -1) {
      gamelogic = new Gamelogic(room, 0x0000FF);
      //by default rooms will be removed automatically after 2 sec if empty
      //setting the persistent flag to true will prevent this
      room.persistent = true;
      room.name = 'Blue Room';
      return gamelogic;
  }

  if (room.id == 'room2') {
      gamelogic = new Gamelogic(room, 0xFF8000);
      room.persistent = true;
      room.name = 'Locked Room';
      room.password = '12345';
      return gamelogic;
  }

  if (room.id == 'room3') {
      gamelogic = new Gamelogic(room, 0x80FF00);
      room.persistent = true;
      return gamelogic;
  }
};
```
#### Room Logic
Every room can have its own custom room logic.
See the [gordon-examples][3] for use cases.

```js
var Gamelogic = require('./gamelogic');

var session = gordon.createSession('session1', 'Session with custom logic');
var lobby = session.createRoom('lobby');

//create the logic module and attach it to the room
lobby.logic = new Gamelogic(lobby);
```

The logic object could also define the following methods to modify the standard protocol flow:

```js
joinLogic(user, proceed)
changeRoomLogic(user, newRoom, oldRoom, proceed)
chatMessageLogic(target, message, proceed)
customMessageLogic(buffer, proceed)
```

Call the passed in proceed function to continue with the
standard protocol flow.

```js
//modifying a join request
this.joinLogic = function (user, proceed) {
    //alter the user's dataObject values
    user.dataObject.getValue(0).writeInt16BE(500, 0);
    user.dataObject.getValue(1).write('the answer is 39!!');

    //simulating a long running e.g. database query
    setTimeout(function () {
        /*to let the user join pass 'true' to provided proceed function*/
        proceed(true);

        /*to cancel the join request pass 'false' */
        //proceed(false);

        /*or close the user's connection*/
        //user.connection.dispose();
        //proceed(false);

    }, 2000);
};

//modify a change room request
this.changeRoomLogic = function (user, newRoom, oldRoom, proceed) {
 //don't allow users to change to room3
 if (newRoom.id == 'room3') {
      proceed(false);
 } else {
     proceed(true);
 }
};

//modifying a chat message
p.chatMessageLogic = function (target, message, proceed) {
    //target could be a user or an object with user.id/user key/value
    message = message.split('').reverse().join('');
    proceed(true, message);
};

//modifying a custom message
p.customMessageLogic = function (buffer, proceed) {
    if (buffer.readUInt16BE(0) == 0xc000){
        var b = new Buffer(4);
        b.writeUInt32BE(0xffffffff, 0);
        proceed(true, b);
    }
};
```
####DataObjects
DataObject are used to synchronize states between the connected clients. DataObjects live inside a room. Every DataObject consists of key/value pairs, where keys must be unique integers (per DataObject) and values must be <a href="http://nodejs.org/api/buffer.html">Buffers</a>.

Every connected user automatically has its own DataObject. Additional DataObjects can be created with the ``room.createDataObject()`` method.

```js
var room = session.createRoom('room1');

var values = {};
values[0] = new Buffer(1);
values[1] = new Buffer(2);
values[2] = new Buffer(2);
values[3] = new Buffer(1);
values[4] = new Buffer(4);

//write the initial values
values[0].writeInt8(1, 0);
values[1].writeInt16BE(500, 0);
values[2].writeInt16BE(500, 0);
values[3].writeInt8(1, 0);
values[4].writeInt32BE(0xff00ff, 0);

//create and broadcast the new DataObject
room.createDataObject(values, true);
```

The server also can update and broadcast values:

```js
var dataObject = user.dataObject;
dataObject.getValue(DataKey.X_POS).writeInt16BE(500, 0);
dataObject.getValue(DataKey.Y_POS).writeInt16BE(500, 0);
dataObject.getValue(DataKey.NAME).write('John Doe Jr.');

//broadcast values to dataObject's room
dataObject.broadcastValues([DataKey.X_POS, DataKey.Y_POS, DataKey.NAME]);
```

  [1]: https://cloud.githubusercontent.com/assets/7307652/2774582/445a43cc-caba-11e3-92f2-a2bc7600b52b.png
  [2]: https://github.com/bma73/gordon-client
  [3]: https://github.com/bma73/gordon-examples