let localConnection = null;
let sendDataChannel = null;
let receiveDataChannel = null;
let socket = null;
let socketConnected = false;
let sendDataChannelOpen = false;
let username = null;
let peerUsername = null;
const delayBetweenEachChunSending = 1; // ms
const eachChunkSizeForSendingFile = 1024 * 100; //  1280 is prefered
const DATA_CHANNEL_MAX_BUFFER_SIZE = 16 * 1024 * 1000; // 16 MB
const WAITING_TIME_FOR_DATA_CHANNEL_TO_BE_READY = 1000; // 1 Second
const DATA_CHANNEL_MIN_BUFFER_THRESHOLD = 5 * 1024 * 1000; // 5MB
const DATA_CHANNEL_MAX_BUFFER_THRESHOLD = 10 * 1024 * 1000; // 10MB
let canSendDataOverDataChannel = false;
let receivedFileData = [];
let receivedBytes = 0;
let receivedFileMetaData = {
  name: null,
  size: null,
  type: null,
  numberOfChunks: null
};

jQuery(document).ready($ => {
  $("#connectToServerBtn").click(() => {
    username = $("#usernameTxt").val();
    if (username == "") {
      alert("enter username");
      return;
    }

    let host = 'https://192.168.43.87:3000'

    socket = io(host, {
      rejectUnauthorized: false
    });
    socket.on("connect", () => {
      socketConnected = true;
      console.log("connected");
      displayMsg("connected");

      socket.emit("login", {
        username: username
      });
    });

    socket.on("info", info => displayMsg(info));
    socket.on("error", error => dispalyErr(error));

    socket.on("usersList", users => {
      console.log(users);
      $("#usersList").html("");
      users.forEach(currUsername => {
        if (username == currUsername) {
          return;
        }
        $("#usersList").append(
          `<option value='${currUsername}'>${currUsername}</option>`
        );
      });
    });
    socket.on("disconnect", () => {
      socketConnected = false;
      console.log("disconnected");
    });

    socket.on("msg", msg => {
      handleSignalingMsg(msg);
    });
  });

  $("#connectToPeerBtn").click(function() {
    initLocalConnection();

    localConnection.createOffer().then(offer => {
      localConnection.setLocalDescription(offer);
      console.log("sending offer");
      console.log(offer);
      displayMsg("Connecting to peer");

      peerUsername = $("#usersList").val();
      socket.emit("msg", {
        type: "offer",
        data: offer,
        from: username,
        to: peerUsername
      });
    });
  });

  $("#sendBtn").click(() => {
    if (
      localConnection.iceConnectionState != "connected" &&
      localConnection.iceConnectionState != "completed"
    ) {
      alert("Please Connect To Peer First");
      return;
    }
    let fileInput = document.getElementById("inputfile");
    if (fileInput.files.length == 0) {
      alert("Please Select File To Send First");
      return;
    }

    let fileToSend = fileInput.files[0];
    let startTime = performance.now();
    let endTime = null;

    let eachChunkSize = eachChunkSizeForSendingFile;
    let numberOfChunks = parseInt(fileToSend.size / eachChunkSize) + 1;
    sendDataChannel.send(
      JSON.stringify({
        name: fileToSend.name,
        size: fileToSend.size,
        type: fileToSend.type,
        numberOfChunks: numberOfChunks
      })
    );

    let numberOfSentChunks = 0;

    let start = 0;
    let fileReader = new FileReader();

    let end = start + eachChunkSize;
    if (end > fileToSend.size) {
      end = fileToSend.size + 1; // reading last byte
    }
    let chunk = fileToSend.slice(start, end);
    fileReader.readAsArrayBuffer(chunk);

    sendDataChannel.onbufferedamountlow = event => {
      console.log(`onbufferedamountlow`);
      console.log(event);
    };

    fileReader.onloadend = event => {
      console.log("onloaded");
      if (event.target.readyState == FileReader.DONE) {
        console.log(`from ${start} to ${start + eachChunkSize} loaded`);
        let chunkNumber = start / eachChunkSize;
        let dataToSend = event.target.result;
        let successCallback = () => {
          start += eachChunkSize;
          if (start > fileToSend.size) {
            $("#sendDataChannelStatusTxt").text("File Sent Successfully");
            endTime = performance.now();
            let takenTime = (endTime - startTime) / 1000;
            displayMsg(
              `Time Token For Sending File: ${takenTime} Second, File Size: ${fileToSend.size /
                1024} KB, Speed: ${fileToSend.size / 1024 / takenTime} KB/S`
            );
            return;
          }
          let end = start + eachChunkSize;
          if (end > fileToSend.size) {
            end = fileToSend.size + 1; // reading last byte
          }
          let chunk = fileToSend.slice(start, end);
          fileReader.readAsArrayBuffer(chunk);
        };

        // displayMsg(`Sending chunk ${chunkNumber} of ${numberOfChunks}`);
        $("#chunkNumberTxt").html(
          `Sent chunks: ${chunkNumber + 1}/${numberOfChunks}`
        );
        setTimeout(() => {
          sendFileChunk(dataToSend, successCallback);
        }, delayBetweenEachChunSending);
      }
    };
  });

  function sendFileChunk(chunk, successCallback) {
    if (sendDataChannel.bufferedAmount > DATA_CHANNEL_MAX_BUFFER_THRESHOLD) {
      $("#sendDataChannelStatusTxt").text(
        "DataChannel Buffer Is Full, Waiting..."
      );
      setTimeout(() => {
        sendFileChunk(chunk, successCallback);
      }, WAITING_TIME_FOR_DATA_CHANNEL_TO_BE_READY);
      return;
    }
    $("#sendDataChannelStatusTxt").text("Sending...");
    sendDataChannel.send(chunk);
    successCallback();
  }

  function displayMsg(msg) {
    $("#resultTxt").append(`<span style='color:green'>${msg}</span><br/>`);
  }

  function dispalyErr(err) {
    $("#resultTxt").append(`<span style='color:red'>${err}</span><br/>`);
  }
  $("#inputTxt").keyup(e => {
    if (e.which == 13) {
      sendMsg();
    }
  });

  // $('#sendBtn').click(() => {
  //     sendMsg()
  // })

  function sendMsg() {
    let txt = $("#inputTxt").val();
    sendDataChannel.send(txt);
    $("#chatTxt").append("<span>Me: </span>" + txt + "<br/>");
    $("#inputTxt")
      .val("")
      .focus();
  }

  function receiveDatachannelCreatedCallback(event) {
    console.log("receiveDatachannelCreatedCallback");
    receiveDataChannel = event.channel;
    receiveDataChannel.onmessage = receiveDataChannelOnMsgCallback;
    receiveDataChannel.onopen = receiveDataChannelOnOpenCallback;
    receiveDataChannel.onclose = receiveDataChannelOncloseCallback;
  }

  function receiveDataChannelOnMsgCallback(event) {
    handleReceivedFile(event.data);
    // $('#chatTxt').append(event.data + '<br/>')
  }

  function receiveDataChannelOnOpenCallback() {
    console.log("receiveDataChannelOnOpenCallback");
  }

  function receiveDataChannelOncloseCallback() {
    console.log("receiveDataChannelOncloseCallback");
  }

  function sendDataChannelOpenCallback(event) {
    console.log("sendDataChannel open event");
    sendDataChannelOpen = true;
    canSendDataOverDataChannel = true;
  }

  function sendDataChannelCloseCallback(event) {
    console.log("sendDataChannel close event");
    console.log(event);
    sendDataChannelOpen = false;
    canSendDataOverDataChannel = false;
  }

  function initLocalConnection() {
    if (localConnection != null) {
      return;
    }

    localConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302"
        }
      ]
    });

    localConnection.ondatachannel = receiveDatachannelCreatedCallback;
    sendDataChannel = localConnection.createDataChannel("myDataChannel");
    sendDataChannel.onopen = sendDataChannelOpenCallback;
    sendDataChannel.onclose = sendDataChannelCloseCallback;
    // sendDataChannel.bufferedAmountLowThreshold = DATA_CHANNEL_MIN_BUFFER_THRESHOLD;
    sendDataChannel.onbufferedamountlow = () => {
      console.log("low buffer");
    };

    localConnection.onicecandidate = e => {
      if (e.candidate) {
        socket.emit("msg", {
          type: "candidate",
          data: e.candidate,
          from: username,
          to: peerUsername
        });
      }
    };

    localConnection.oniceconnectionstatechange = event => {
      console.log("oniceconnectionstatechange");
      switch (localConnection.iceConnectionState) {
        case "connected":
          // case 'completed':
          displayMsg("Peer Connection Connected");
          break;
        case "disconnected":
          dispalyErr("Peer Connection Disconnected");
          break;
      }
    };
  }

  let receivingStartTime = null;
  let receivingEndTime = null;
  function handleReceivedFile(fileData) {
    try {
      let data = JSON.parse(fileData);
      receivingStartTime = performance.now();
      receivedFileMetaData = data;
    } catch (itsNotJson) {
      receivedBytes += fileData.byteLength;
      receivedFileData.push(fileData);
      // displayMsg(
      //   `Received chunk ${receivedFileData.length} of ${
      //     receivedFileMetaData.numberOfChunks
      //   }`
      // );
      $("#chunkNumberTxt").html(
        `Received chunks: ${receivedFileData.length}/${
          receivedFileMetaData.numberOfChunks
        }`
      );

      console.log(`receivedBytes: ${receivedBytes}`)
      if (receivedBytes == receivedFileMetaData.size) {
        fileReceiveEnded();
      }
    }
  }

  function fileReceiveEnded() {
    receivingEndTime = performance.now();
    let takenTime = (receivingEndTime - receivingStartTime) / 1000;
    displayMsg(
      `Time Token For Receving File: ${takenTime} Second, File Size: ${receivedFileMetaData.size /
        1024} KB, Speed: ${receivedFileMetaData.size / 1024 / takenTime} KB/S`
    );
    let fileBlob = new Blob(receivedFileData, {
      type: receivedFileMetaData.type
    });
    let linkToDownload = document.createElement("a");
    linkToDownload.setAttribute("href", window.URL.createObjectURL(fileBlob));
    linkToDownload.setAttribute("download", receivedFileMetaData.name);
    linkToDownload.innerText =
      "Click Here To Download " + receivedFileMetaData.name;
    $("#resultTxt").append(linkToDownload);
    $("#resultTxt").append("<br/>");

    receivedFileMetaData = {};
    receivedFileData = [];
    receivedBytes = 0;
  }

  function handleSignalingMsg(msg) {
    console.log("msg from signaling");
    console.log(msg);
    peerUsername = msg.from;

    switch (msg.type) {
      case "candidate":
        if (localConnection == null) {
          initLocalConnection();
        }
        localConnection.addIceCandidate(msg.data);
        break;
      case "offer":
        if (localConnection == null) {
          initLocalConnection();
        }
        localConnection.setRemoteDescription(msg.data);
        localConnection.createAnswer().then(answer => {
          localConnection.setLocalDescription(answer);
          console.log("sending answer");
          console.log(answer);
          socket.emit("msg", {
            type: "answer",
            data: answer,
            from: username,
            to: peerUsername
          });
        });
        break;
      case "answer":
        localConnection.setRemoteDescription(msg.data);
        break;
    }
  }

  $("#clearScreen").click(() => {
    $("#resultTxt").html("");
  });
});
