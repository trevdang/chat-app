const crypto = require('crypto');

class SessionError extends Error {};

function SessionManager (){
	// default session length - you might want to
	// set this to something small during development
	const CookieMaxAgeMs = 600000;

	// keeping the session data inside a closure to keep them protected
	const sessions = {};

	// might be worth thinking about why we create these functions
	// as anonymous functions (per each instance) and not as prototype methods
	this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
        var token = crypto.randomBytes(127).toString('hex');
		var expireTime = Date.now();

		if(maxAge) {
			expireTime += maxAge;
		}

        var sessionObject = {username: username, timeCreated: Date.now(), expireTime: expireTime};

        sessions[token] = sessionObject;

        response.cookie("cpen322-session", token, {maxAge: maxAge});
        setTimeout(() => {delete sessions[token]}, maxAge);
	};

	this.deleteSession = (request) => {
		delete request["username"];
		delete sessions[request["session"]];
		delete request["session"];
	};

	this.middleware = (request, response, next) => {
		var cookieHeader = request.headers["cookie"];
		if(!cookieHeader) {
			next(new SessionError("Cookie does not exist"));
			return;
		}
		else {
			if(cookieHeader.includes(";")) {
				var noColons = cookieHeader.split("; ");
				var parsedCookieHeader = noColons[0].split("=");
				var cookieVal = parsedCookieHeader[1];
				if(sessions[cookieVal]) {
					request["username"] = sessions[cookieVal]["username"];
					request["session"] = cookieVal;
					next();
					return;
				}
				else {
					next(new SessionError("Cookie token could not be found in sessions object"));
					return;
				}
			}
			else {
				var parsedCookieHeader = cookieHeader.split("=");
				var cookieVal = parsedCookieHeader[1];
				if(sessions[cookieVal]) {
					request["username"] = sessions[cookieVal]["username"];
					request["session"] = cookieVal;
					next();
					return;
				}
				else {
					next(new SessionError("Cookie token could not be found in sessions object"));
					return;
				}
			}
		}
	};

	// this function is used by the test script.
	// you can use it if you want.
	this.getUsername = (token) => ((token in sessions) ? sessions[token].username : null);
};

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError;

module.exports = SessionManager;