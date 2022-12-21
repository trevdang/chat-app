// Removes the contents of the given DOM element (equivalent to elem.innerHTML = '' but faster)
function emptyDOM (elem){
    while (elem.firstChild) elem.removeChild(elem.firstChild);
}

// Creates a DOM element from the given HTML string
function createDOM (htmlString){
    let template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild;
}

// Example usage
var messageBox = createDOM(
    `<div>
        <span>Alice</span>
        <span>Hello World</span>
    </div>`
    );

// Helper function for whitespace
function onlySpaces(str) {
  return str.trim().length === 0;
}

// Helper function for sanitizing user input (note: removed some regex from the map)
// Source: https://stackoverflow.com/questions/2794137/sanitizing-user-input-before-adding-it-to-the-dom-in-javascript
function sanitize(string) {
  const map = {
      '<': '&lt;',
      '>': '&gt;',
  };
  const reg = /[<>]/ig;
  return string.replace(reg, (match)=>(map[match]));
}

// Global variable for profile
var profile = {};

function main() {
    var lobby = new Lobby()
    var lobbyView = new LobbyView(lobby);
    var chatView = new ChatView();
    var profileView = new ProfileView();

    var socket = new WebSocket("ws://localhost:8000");
    chatView.socket = socket;
    socket.addEventListener("message", function(message) {
      var msg = JSON.parse(message["data"]);
      var roomObj = lobby.getRoom(msg["roomId"]);
      roomObj.addMessage(msg["username"], msg["text"]);
    })

    cpen322.export(arguments.callee, {lobby, lobbyView, chatView, profileView, renderRoute, refreshLobby, socket, makeConversationLoader});

    function refreshLobby() {
      var roomList = Service.getAllRooms();

      roomList.then(value=>{
        for(var i = 0; i < value.length; i++) {
          if(lobby.rooms[value[i]._id]) {
            lobby.rooms[value[i]._id].name = value[i].name;
            lobby.rooms[value[i]._id].image = value[i].image;
          }
          else {
            lobby.addRoom(value[i]._id, value[i].name, value[i].image, value[i].messages);
          }
        }
      });
    }

    Service.getProfile().then(value => {
      profile["username"] = value["username"];
    });

    function renderRoute() {
        var url = window.location.hash;
        var urlArr = url.split("/");

        if(window.location.hash == "#/profile") {
            var div = document.getElementById("page-view");

            emptyDOM(div);

            var profileDiv = profileView.elem;
            div.append(profileDiv);
        }
        else if(urlArr[1] == "chat") {
            var div = document.getElementById("page-view");     

            emptyDOM(div);
            var chatDiv = chatView.elem;

            if(lobby.getRoom(urlArr[2])) {
              chatView.setRoom(lobby.getRoom(urlArr[2]));
            }

            div.append(chatDiv);
        }
        else {
            var div = document.getElementById("page-view");

            emptyDOM(div);

            var indexDiv = lobbyView.elem;
            div.append(indexDiv);
        }
    }

    refreshLobby();

    setInterval(refreshLobby, 5000);

    window.addEventListener('popstate', renderRoute);
}

class LobbyView {
    constructor(lobby) {
        var self = this;
        this.elem = createDOM(
            `<div class="content">
            <ul class="room-list">
              <li>
                <img src="assets/everyone-icon.png">
                <a href="#/chat/room-1">Everyone in CPEN322</a>
              </li>
              <li>
                <img src="assets/bibimbap.jpg">
                <a href="#/chat/room-2">Foodies Only</a>
              </li>
              <li>
                <img src="assets/minecraft.jpg">
                <a href="#/chat/room-3">Gamers Unite</a>
              </li>
            </ul>
            <div class="page-control">
              <input type="text">
              <button type="button">Submit</button>
            </div>
          </div>`
        );
        this.lobby = lobby;
        this.lobby.onNewRoom = function() {
          self.redrawList();
        };
        this.listElem = this.elem.querySelector("ul.room-list");
        this.inputElem = this.elem.querySelector("input");
        this.buttonElem = this.elem.querySelector("button");

        this.buttonElem.addEventListener('click', function() {
          var ret = Service.addRoom({"name": self.inputElem.value, "image": "assets/everyone-icon.png"});
          ret.then(value => {
            if(value) {
              self.lobby.addRoom(value["_id"], value["name"], value["image"]);
            }
          }) 
          self.inputElem.value = '';
        });
        this.redrawList();
    }

    redrawList() {
      emptyDOM(this.listElem);
      for(var key in this.lobby.rooms) {
        var value = this.lobby.rooms[key];
        var room = createDOM(
        `<li>
        <img src="${value.image}">
        <a href="#/chat/${value.id}">${value.name}</a>
        </li>`);
        this.listElem.append(room);
      }
    }
}

class ChatView {
    constructor(socket) {
        var self = this;
        this.elem = createDOM(
            `<div class="content">
            <h4 class="room-name">
              EVERYONE IN CPEN322
            </h4>
            <div class="message-list">
              <div class="message">
                <span class="message-user">other user</span>
                <span class="message-text">hey!</span>
              </div>
              <div class="my-message">
                <span class="message-user">me</span>
                <span class="message-text">yo!</span>
              </div>
            </div>
            <div class="page-control">
              <textarea rows="4" cols="50"></textarea>
              <button type="button">Send</button>
            </div>
          </div>`
        );

        this.socket = socket;
        this.room = null;
        this.titleElem = this.elem.querySelector("h4");
        this.chatElem = this.elem.querySelector("div.message-list");
        this.inputElem = this.elem.querySelector("textarea");
        this.buttonElem = this.elem.querySelector("button");

        this.buttonElem.addEventListener('click', function() {self.sendMessage();});
        this.inputElem.addEventListener('keyup', function(e) {
          if(e.keyCode == 13) {
            if(!(e.shiftKey)) {
              self.sendMessage();
            }
          }
        });
        this.chatElem.addEventListener('wheel', function(event) {
          if(self.room.canLoadConversation == true && self.chatElem.scrollTop === 0 && event.deltaY < 0) {
            self.room.getLastConversation.next();
          }
        })
    }

    sendMessage() {
      this.room.addMessage(profile.username, this.inputElem.value);
      this.socket.send(JSON.stringify({roomId: this.room.id, text: this.inputElem.value}));
      this.inputElem.value = '';
    }

    setRoom(room) {
      this.room = room;
      var self = this;

      emptyDOM(this.titleElem);
      this.titleElem.append(this.room.name);

      emptyDOM(this.chatElem);
      for(var message in this.room.messages) {
        if(this.room.messages[message].username == profile.username) {
          this.chatElem.append(createDOM(`
          <div class="my-message">
            <span class="message-user">${this.room.messages[message].username}</span>
            <span class="message-text">${this.room.messages[message].text}</span>
          </div>`
          ));
        }
        else {
          this.chatElem.append(createDOM(`
          <div class="message">
            <span class="message-user">${this.room.messages[message].username}</span>
            <span class="message-text">${this.room.messages[message].text}</span>
          </div>`
          ));
        }
      }

      this.room.onNewMessage = function(message) {
        if(message.username == profile.username) {
          var myUserMessage = createDOM(`
          <div class="message my-message">
            <span class="message-user">${message.username}</span>
            <span class="message-text">${sanitize(message.text)}</span>
          </div>`);
          self.chatElem.append(myUserMessage);
          }
        else {
          var otherUserMessage = createDOM(`
          <div class="message">
            <span class="message-user">${message.username}</span>
            <span class="message-text">${sanitize(message.text)}</span>
          </div>`);
          self.chatElem.append(otherUserMessage);
        }
      }

      this.room.onFetchConversation = function(conversation) {
        var hb = self.chatElem.scrollHeight;
        for(var i = conversation["messages"].length - 1; i >= 0; i--) {
          var otherUserMessage = createDOM(`
          <div class="message">
            <span class="message-user">${conversation["messages"][i]["username"]}</span>
            <span class="message-text">${conversation["messages"][i]["text"]}</span>
          </div>`);
          self.chatElem.insertBefore(otherUserMessage, self.chatElem.firstChild);
        }
        var ha = self.chatElem.scrollHeight;
        self.chatElem.scrollTo({"top": ha - hb, "behavior": "auto"});
      }
    }
}

class ProfileView {
    constructor() {
        this.elem = createDOM(
            `<div class="content">
        <div class="profile-form">
            <div class="form-field">
            <label>Username</label>
            <input type="text">
            </div>
            <div class="form-field">
            <label>Password</label>
            <input type="password">
            </div>
            <div class="form-field">
            <label>Avatar Image</label>
            <input type="file">
            </div>
        </div>
        <div class="page-control">
            <button type="button">Save</button>
        </div>
        </div>`
        );
    }
}

class Room {
  constructor(id, name, image="assets/everyone-icon.png", messages=[]) {
    this.id = id;
    this.name = name;
    this.image = image;
    this.messages = messages;
    this.canLoadConversation = true;
    this.getLastConversation = makeConversationLoader(this);
    this.initTime = Date.now();
  }

  addMessage(username, text) {
    if(text == "" || onlySpaces(text)) {
      return;
    }
    else {
      var output = {
        username: username,
        text: sanitize(text),
      }
      this.messages.push(output);
    }

    if(typeof this.onNewMessage === "function") {
      this.onNewMessage(output);
    }
  }

  addConversation(conversation) {
    this.messages = conversation["messages"].concat(this.messages);
    if(typeof this.onFetchConversation === "function") {
      this.onFetchConversation(conversation);
    }
  }
}

class Lobby {
  constructor() {
    this.rooms = {};
  }

  getRoom(roomId) {
    for(var key in this.rooms) {
      var value = this.rooms[key]
      if(value.id == roomId) {
        return value;
      }
    }
  }

  addRoom(id, name, image, messages) {
    this.rooms[id] = new Room(id, name, image, messages);
    if(typeof this.onNewRoom === "function") {
      this.onNewRoom(this.rooms[id]);
    }
  }
}

function *makeConversationLoader(room) {
  var lastConvoTime = room.initTime;
  while(room.canLoadConversation == true) {
    yield new Promise((resolve, reject) => {
      room.canLoadConversation = false;
      Service.getLastConversation(room["id"], lastConvoTime).then(value => {
        if(value) {
          lastConvoTime = value["timestamp"];
          room.canLoadConversation = true;
          room.addConversation(value);
          resolve(value);
        }
        else {
          resolve(null);
          return;
        }
      })
    })
  }
}

var Service = {
  origin: window.location.origin,
  getAllRooms: function() {
    var url = Service.origin + "/chat";
    var p = new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url);
      xhr.onload = function() {
        if(xhr.status == 200) {
          try {
            var response = JSON.parse(xhr.responseText);
            resolve(response);
          }
          catch(e) {
            return e;
          }
        }
        else {
          reject(new Error(xhr.responseText));
        }
      }
      xhr.onerror = function(error) {
        reject(new Error(error));
      }
      xhr.send();
    });

    return p;
  },
  addRoom: function(data) {
    var url = Service.origin + "/chat";
    var p = new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Content-Type", "application/json")
      xhr.onload = function() {
        if(xhr.status == 200) {
          resolve(JSON.parse(xhr.responseText));
        }
        else {
          reject(new Error(xhr.responseText));
        }
      }
      xhr.onerror = function(error) {
        reject(new Error(error));
      }
      xhr.send(JSON.stringify(data));
    });

    return p;
  },
  getLastConversation: function(roomId, before) {
    var url = Service.origin + "/chat/" + roomId + "/messages?before=" + before;
    var p = new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url);
      xhr.onload = function() {
        if(xhr.status == 200) {
          resolve(JSON.parse(xhr.responseText));
        }
        else {
          reject(new Error(xhr.responseText));
        }
      }
      xhr.onerror = function(error) {
        reject( new Error(error));
      }
      xhr.send();
    });

    return p;
  },
  getProfile: function() {
    var url = Service.origin + "/profile";
    var p = new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url);
      xhr.onload = function() {
        if(xhr.status == 200) {
          try {
            var response = JSON.parse(xhr.responseText);
            resolve(response);
          }
          catch(e) {
            return e;
          }
        }
        else {
          reject(new Error(xhr.responseText));
        }
      }
      xhr.onerror = function(error) {
        reject(new Error(error));
      }
      xhr.send();
    });

    return p;
  }
}

window.addEventListener('load', main);