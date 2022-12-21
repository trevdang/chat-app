const { MongoClient, ObjectID, ObjectId } = require('mongodb');	// require the mongodb driver

/**
 * Uses mongodb v4.2+ - [API Documentation](http://mongodb.github.io/node-mongodb-native/4.2/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen322 app.
 */
function Database(mongoUrl, dbName){
	if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
	this.connected = new Promise((resolve, reject) => {
		MongoClient.connect(
			mongoUrl,
			{
				useNewUrlParser: true
			},
			(err, client) => {
				if (err) reject(err);
				else {
					console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
					resolve(client.db(dbName));
				}
			}
		)
	});
	this.status = () => this.connected.then(
		db => ({ error: null, url: mongoUrl, db: dbName }),
		err => ({ error: err })
	);
}

Database.prototype.getRooms = function(){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: read the chatrooms from `db`
			 * and resolve an array of chatrooms */
            if(db) {
                db.collection("chatrooms").find({}).toArray((err, rooms) => {
					if(err) {
						reject(err);
					}
					else {
						var chatroomsArr = [];
						for(var i = 0; i < rooms.length; i++) {
							chatroomsArr.push(rooms[i]);
						}
						resolve(chatroomsArr);
					}
				});
            }
            else {
                reject(new Error(db));
            }
		})
	)
}

Database.prototype.getRoom = function(room_id){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: read the chatroom from `db`
			 * and resolve the result */
			if(db) {
				db.collection("chatrooms").find({}).toArray((err, rooms) => {
					if(err) reject(err);
					else {
						for(var i = 0; i < rooms.length; i++) {
							if(typeof rooms[i]["_id"] === "object") {
								if(rooms[i]["_id"].toString() == room_id) {
									// console.log("OBJECT");
									rooms[i]["_id"] = room_id;
									// console.log(rooms[i]);
									resolve(rooms[i]);
									break;
								}
							}
							if(typeof rooms[i]["_id"] === "string") {
								if(rooms[i]["_id"] == room_id) {
									// console.log("STRING");
									rooms[i]["_id"] = room_id;
									// console.log(rooms[i]);
									resolve(rooms[i]);
									break;
								}
							}
						}
						resolve(null);
					}
				})
			}
			else {
				reject(new Error(db));
			}
		})
	)
}

Database.prototype.addRoom = function(room){
	return this.connected.then(db => 
		new Promise((resolve, reject) => {
			/* TODO: insert a room in the "chatrooms" collection in `db`
			 * and resolve the newly added room */
			if(db) {
				db.collection("chatrooms").insertOne(room, (err, res) => {
					if(err) {
						throw err;
					}
					else {
						if(room["name"]) {
							if(typeof res["insertedId"] === 'object') {
								room["_id"] = res["insertedId"].toString();
							}
							else {
								room["_id"] = res["insertedId"];
							}
							resolve(room);
						}
						else {
							reject(new Error(room["_id"] + " has no name parameter"));
						}
					}
				});
			}
			else {
				reject(new Error(db));
			}
		})
	)
}

Database.prototype.getLastConversation = function(room_id, before){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: read a conversation from `db` based on the given arguments
			 * and resolve if found */
			if(db) {
				db.collection("conversations").find({}).toArray((err, conversations) => {
					if(before) {
						var timestampArr = [];
						for(var i = 0; i < conversations.length; i++) {
							if(conversations[i]["room_id"] == room_id) {
								timestampArr.push(conversations[i]["timestamp"]);
							}
						}
						var closest = timestampArr.reduce((prev, curr) => {
							return (Math.abs(curr - before) < Math.abs(prev - before) ? curr : prev);
						});
						var timestampArrSorted = timestampArr.sort();
						var timeSave;
						for(var i = timestampArrSorted.length - 1; i >= 0; i--) {
							if(closest > before) {
								if(timestampArrSorted[i] < before && timestampArrSorted[i] < closest) {
									timeSave = timestampArrSorted[i];
									break;
								}
							}
							if(closest == before) {
								if(timestampArrSorted[i] < closest) {
									timeSave = timestampArrSorted[i];
									break;
								}
							}
							if(closest < before) {
								if(timestampArrSorted[i] == closest) {
									timeSave = timestampArrSorted[i];
									break;
								}
							}
						}
						for(var i = 0; i < conversations.length; i++) {
							if(conversations[i]["timestamp"] == timeSave && conversations[i]["room_id"] == room_id) {
								resolve(conversations[i]);
							}
						}
						resolve(null);
					}
					else {
						var timestampArr = [];
						for(var i = 0; i < conversations.length; i++) {
							if(conversations[i]["room_id"] == room_id) {
								timestampArr.push(conversations[i]["timestamp"]);
							}
						}
						var closest = timestampArr.reduce((prev, curr) => {
							return (Math.abs(curr - Date.now()) < Math.abs(prev - Date.now()) ? curr : prev);
						});
						var timestampArrSorted = timestampArr.sort();
						var timeSave;
						for(var i = timestampArrSorted.length - 1; i >= 0; i--) {
							if(closest > Date.now()) {
								if(timestampArrSorted[i] < Date.now && timestampArrSorted[i] < closest) {
									timeSave = timestampArrSorted[i];
									break;
								}
							}
							if(closest == Date.now()) {
								if(timestampArrSorted[i] < closest) {
									timeSave = timestampArrSorted[i];
									break;
								}
							}
							if(closest < Date.now()) {
								if(timestampArrSorted[i] == closest) {
									timeSave = timestampArrSorted[i];
									break;
								}
							}
						}
						for(var i = 0; i < conversations.length; i++) {
							if(conversations[i]["timestamp"] == timeSave && conversations[i]["room_id"] == room_id) {
								resolve(conversations[i]);
							}
						}
						resolve(null);
					}
				})
			}
			else {
				reject(new Error(db));
			}
		})
	)
}

Database.prototype.addConversation = function(conversation){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			/* TODO: insert a conversation in the "conversations" collection in `db`
			 * and resolve the newly added conversation */
			if(db) {
				db.collection("conversations").insertOne(conversation, (err, res) => {
					if(err) throw err;
					else {
						conversation["_id"] = res["insertedId"];
						if(!conversation["room_id"] || !conversation["timestamp"] || !conversation["messages"]) {
							reject(new Error(conversation["room_id"] + " is missing parameters"));
						}
						resolve(conversation);
					}
				})
			}
			else {
				reject(new Error(db))
			}
		})
	)
}

Database.prototype.getUser = function(username){
	return this.connected.then(db => 
		new Promise((resolve, reject) => {
			if(db) {
				resolve(db.collection("users").findOne({username: username}));
			}
			else {
				reject(new Error(db));
			}
		})
	)
}

module.exports = Database;