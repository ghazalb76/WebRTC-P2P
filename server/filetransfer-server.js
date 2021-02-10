const fs = require('fs')
const express = require('express')
var app = express();
var options = {
    key: fs.readFileSync('cert/1.key'),
    cert: fs.readFileSync('cert/1.cert')
};

var https = require('https').Server(options, app);
var io = require('socket.io')(https);

app.use(express.static('..'))

app.get('/', function (req, res) {
    res.send('<h1>Hello world</h1>');
});

https.listen(3000, function () {
    console.log('listening on *:3000');
});

let users = []

function getUserSocketId(username) {
    for (let index = 0; index < users.length; index++) {
        const user = users[index];
        if (user.username == username) {
            return user.socketid
        }
    }
    return null
}

function removeUser(username) {
    for (let index = 0; index < users.length; index++) {
        const user = users[index];
        if (user.username == username) {
            users.splice(index, 1)
            return true
        }
    }
    return false
}

function sendUsersList() {
    let usernamesList = users.map(item => item.username)
    io.emit('usersList', usernamesList)
}
io.on('connection', client => {
    console.log('connected')

    let username = null
    client.on('login', data => {
        //only username is required
        if ('username' in data && String(data.username) != '') {
            if (users.indexOf(data.username) == -1) {
                username = data.username
                users.push({
                    username: username,
                    socketid: client.id
                })
                client.emit('info', 'login successfull')
                sendUsersList()

            } else {
                client.emit('error', 'username is not available')
            }
        } else {
            client.emit('error', 'username is not valid')
        }
    })

    function isValid() {
        let isValid = true
        if (username == null) {
            isValid = false
        }
        if (!isValid)
            client.emit('error', 'request is not valid')

        return isValid
    }

    client.on('msg', msg => {
        if (!isValid()) {
            return
        }
        if (username == msg.to) {
            client.emit('error', 'cannot send msg to yourself')
            return
        }
        console.log(`msg from ${username}`)
        let socketid = getUserSocketId(msg.to)
        console.log(`to username ${msg.to} and socketid: ${socketid}`)
        io.to(socketid).emit('msg', msg)
    });

    client.on('disconnect', (reason) => {
        console.log(`client disconnected, reason ${reason}`)
        removeUser(username)
        sendUsersList()
    });
});