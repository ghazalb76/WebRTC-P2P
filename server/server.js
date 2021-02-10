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

app.get('/', function(req, res){
  res.send('<h1>Hello world</h1>');
});

https.listen(3000, function(){
  console.log('listening on *:3000');
});

io.on('connection', client => {
    console.log('connected')

    client.on('msg', msg => {
        client.broadcast.emit('msg', msg)
        console.log(msg)
    });
    client.on('disconnect', (reason) => {
        console.log('client disconnected, reason ${reason}')
    });
});
