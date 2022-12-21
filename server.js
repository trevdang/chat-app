const path = require('path');
const fs = require('fs');
const express = require('express');
const cpen322 = require('./cpen322-tester.js');
const ws = require('ws');
const Database = require("./Database.js");
const SessionManager = require("./SessionManager.js");
const crypto = require('crypto');
const { request } = require('http');
const messageBlockSize = 10;

function logRequest(req, res, next){
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');

// express app
let app = express();

app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);							// logging for debug

var db = new Database("mongodb://127.0.0.1:27017", "cpen322-messenger");
var sessionManager = new SessionManager();

// serve static files (client-side)
app.use('/login', express.static(clientApp + '/login.html', {extensions: ['html']}));

app.route('/login').post(function(req, res, next) {
	var reqBody = JSON.parse(JSON.stringify(req.body));
	db.getUser(reqBody["username"]).then(value => {
		if(value) {
			if(isCorrectPassword(reqBody["password"], value["password"])) {
				sessionManager.createSession(res, reqBody["username"]);
				res.redirect("/");
			}
			else {
				res.redirect("/login");
			}
		}
		else {
			res.redirect("/login");
		}
	})
})

app.use(sessionManager.middleware);

app.use('/', express.static(clientApp, { extensions: ['html'] }));
app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});

var messages = {};
db.getRooms().then((value)=>{
	for(var i = 0; i < value.length; i++) {
		messages[value[i]["_id"]] = [];
	}
})

app.route('/chat').get(function(req, res, next) {
	db.getRooms().then((value)=>{
		var rooms = []
		for(var i = 0; i < value.length; i++) {
			var assocArrRoom = value[i];
			assocArrRoom["messages"] = messages[value[i]["_id"]];
			rooms.push(assocArrRoom);
		}
		res.send(rooms);
	});
}).post(function(req, res, next) {
	var reqBody = JSON.parse(JSON.stringify(req.body));
	if(!reqBody["name"]) {
		res.status(400);
		res.send("Error: no 'name' field");
	}
	else {
		var room = {};
		room["name"] = reqBody["name"];
		room["image"] = reqBody["image"];
		db.addRoom(room).then(value=>{
			messages[value["_id"]] = [];
			res.status(200);
			res.send(value);
		});
	}
})

app.route('/chat/:room_id').get(function(req, res, next) {
	db.getRoom(req.params["room_id"]).then((value)=>{
		if(value != null) {
			res.status(200);
			res.send(value);
		}
		else {
			res.status(404);
			res.send(value);
		}
	});
})

app.route('/chat/:room_id/messages').get(function(req, res, next) {
	db.getLastConversation(req.params["room_id"], req.query["before"]).then((value)=>{
		if(value != null) {
			res.status(200);
			res.send(value);
		}
		else {
			res.status(404);
			res.send(value);
		}
	})
})

app.route('/profile').get(function(req, res, next) {
	var profileObj = {};
	profileObj["username"] = req["username"];
	res.send(profileObj);
})

app.route('/logout').get(function(req, res, next) {
	sessionManager.deleteSession(req);
	res.redirect("/login");
})

function isCorrectPassword(password, saltedHash) {
	var salt = saltedHash.substring(0, 20);
	var saltedPassword = password.concat(salt);
	
	var shaHash = crypto.createHash('sha256').update(saltedPassword).digest('base64');
	var saltAndHash = salt.concat(shaHash);

	if(saltAndHash == saltedHash) {
		return true;
	}
	else {
		return false;
	}
}

app.use((err, req, res, next) => {
	if(err instanceof SessionManager.Error) {
		if(req.headers["accept"] == "application/json") {
			res.status(401);
			res.send(err);
		}
		else {
			res.redirect("/login");
		}
	}
	else {
		res.status(500);
		res.send("err is not a SessionManager Error");
	}
})

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

var broker = new ws.Server({port: 8000});
broker.on("connection", (client, req) => {
	var cookieHeader = req.headers["cookie"];
	if(!cookieHeader) {
		client.close();
	}
	else {
		var parsedCookieHeader = cookieHeader.split("=");
		if(!sessionManager.getUsername(parsedCookieHeader[1])) {
			client.close();
		}
		client.on("message", (message) => {
			var clientMsg = JSON.parse(message);
			clientMsg["username"] = sessionManager.getUsername(parsedCookieHeader[1]);
			clientMsg["text"] = sanitize(clientMsg["text"]);

			messages[clientMsg["roomId"]].push(clientMsg);
	
			if(messages[clientMsg["roomId"]].length == messageBlockSize) {
				var conversationToAdd = {};
				conversationToAdd["room_id"] = clientMsg["roomId"];
				conversationToAdd["timestamp"] = Date.now();
				conversationToAdd["messages"] = messages[clientMsg["roomId"]];
				db.addConversation(conversationToAdd);
				messages[clientMsg["roomId"]] = [];
			}
	
			broker.clients.forEach((element) => {
				if(element != client) {
					element.send(JSON.stringify(clientMsg));
				}
			})
		});
	}
})

// cpen322.connect('http://52.43.220.29/cpen322/test-a3-server.js');
// cpen322.connect('http://52.43.220.29/cpen322/test-a4-server.js');
cpen322.connect('http://52.43.220.29/cpen322/test-a5-server.js');
cpen322.export(__filename, {app, messages, broker, db, messageBlockSize, sessionManager, isCorrectPassword});