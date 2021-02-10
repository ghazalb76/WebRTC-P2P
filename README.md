# WebRTC-P2P
Use WebRTC to establish peer to peer connection and transfer files

### Requirements
- express
- socketio

### How to run

1. Change all the IPs to the server's Ip
2. Turn off local firewall
3. Open terminal and type:
    ```
    cd Server
    node filetransfer-server.js
    ```
### Features

- Peer 2 Peer File Transfer
- Create Chunks
- User Authentication
- Sent Files History
- Graphical User Interface

### How does it works?

##### Signaling Channel: Written in node.js (filetransfer-server.js)
1.	Client connects to server
2.	Server fetches client's username 
3.	Server assigns id to client and adds it to userList
4.	Server returns the other online users
5.	Transfer SDP

##### Data Channel: Uses webRTC (filetransfer.js)
1. Transfer Data between 2 peers (Serverless)
2. Two channels one for send & one for receive
3. For receiving channel callback, parse files, gather chunks and save the whole received file
	 For sending channel, create chunks from file and send  Them over datachannel.

