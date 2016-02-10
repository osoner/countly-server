'use strict';

var util = require('util'),
	HTTP = require('./http.js'),
	merge = require('merge'),
	Err = require('./error.js'),
	constants = require('./constants'),
	DEFAULTS = constants.OPTIONS,
	EVENTS = constants.SP,
	log = require('../../../../../api/utils/log.js')('push:gcm'),
	https = require('https');

var GCM = function(options){
	if (false === (this instanceof GCM)) {
        return new GCM(options);
    }

	HTTP.call(this, merge({}, DEFAULTS.gcm, options), log);
};
util.inherits(GCM, HTTP);

/**
 * @private
 */
GCM.prototype.onRequestDone = function(note, response, data) {
	var code = response.statusCode;

    this.emit(EVENTS.MESSAGE, this.noteMessageId(note), this.noteDevice(note).length);
	if (code >= 500) {
		this.handlerr(note, Err.CONNECTION, 'GCM Unavailable');
    } else if (code === 401) {
		this.handlerr(note, Err.CREDENTIALS, 'GCM Unauthorized', this.noteMessageId(note));
    } else if (code === 400) {
		this.handlerr(note, Err.MESSAGE, 'GCM Bad message', this.noteMessageId(note));
    } else if (code !== 200) {
		this.handlerr(note, Err.CONNECTION, 'GCM Bad response code ' + code);
    } else {
		this.requesting = false;
    	try {
            var obj = JSON.parse(data);
            if (obj.failure === 0 && obj.canonical_ids === 0) {
                // this.emit(EVENTS.MESSAGE, noteMessageId(note), noteDevice(note).length);
            } else if (obj.results) {
            	var resend = [], devicesWithInvalidTokens = [], devicesWithBadCredentials = [], validDevices = [], i, device, oldDevices = this.noteDevice(note);

                for (i in obj.results) {
                    var result = obj.results[i];
                    device = oldDevices[i];

                    if (result.message_id) {
                    	if (result.registration_id) {
	                    	devicesWithInvalidTokens.push({bad: device, good: result.registration_id});
                    	}
                    	validDevices.push(device);
                    } else if (result.error === 'MessageTooBig') {
	                	this.handlerr(note, Err.MESSAGE, 'GCM Message Too Big', this.noteMessageId(note), devicesWithBadCredentials);
	                	return;
                    } else if (result.error === 'InvalidDataKey') {
	                	this.handlerr(note, Err.MESSAGE, 'Invalid Data Key: ' + data, this.noteMessageId(note));
	                	return;
                    } else if (result.error === 'InvalidTtl') {
	                	this.handlerr(note, Err.MESSAGE, 'Invalid Time To Live: ' + data, this.noteMessageId(note));
	                	return;
                    } else if (result.error === 'InvalidTtl') {
	                	this.handlerr(note, Err.MESSAGE, 'Invalid Time To Live: ' + data, this.noteMessageId(note));
	                	return;
                    } else if (result.error === 'InvalidPackageName') {
	                	this.handlerr(note, Err.MESSAGE, 'Invalid Package Name: ' + data, this.noteMessageId(note));
	                	return;
                    } else if (result.error === 'Unavailable' || result.error === 'InternalServerError') {
                    	resend.push(device);
                    } else if (result.error === 'MismatchSenderId') {
                    	devicesWithBadCredentials.push(device);
                    } else if (result.error === 'NotRegistered' || result.error === 'InvalidRegistration') {
                    	devicesWithInvalidTokens.push({bad: device});
                    } else if (result.error) {
                    	devicesWithInvalidTokens.push({bad: device});
                    }
                }


                if (devicesWithInvalidTokens.length) {
					this.handlerr(note, Err.TOKEN, 'GCM Invalid tokens', this.noteMessageId(note), devicesWithInvalidTokens);
                }

                if (validDevices.length) {
	                // this.emit(EVENTS.MESSAGE, noteMessageId(note), validDevices.length);
                }

                if (devicesWithBadCredentials.length) {
                	this.handlerr(note, Err.CREDENTIALS, 'GCM Mismatched Sender', this.noteMessageId(note), devicesWithBadCredentials);
                } else if (resend.length) {
                	note[0] = resend;
					this.handlerr(note, Err.CONNECTION, 'GCM Unavailable');
                }
            }
			this.serviceImmediate();
    	} catch (e) {
			this.handlerr(note, Err.CONNECTION, e, this.noteMessageId(note));
    	}
	}
};

/**
 * @private
 */
GCM.prototype.request = function(note, callback) {
	var devices = this.noteDevice(note), content = this.noteData(note);
    log.d('Constructing request with content %j for devices %j', content, devices);

    content.registration_ids = devices;
	content = JSON.stringify(content);
    log.d('Final content %j', content);

	var options = {
		hostname: 'android.googleapis.com',
		port: 443,
		path: '/gcm/send',
		method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-length': Buffer.byteLength(content, 'utf8'),
            'Authorization': 'key=' + this.options.key,
        },
	};

	if (!this.agent) {
		this.agent = new https.Agent(options);
		this.agent.maxSockets = 1;
	}

	options.agent = this.agent;

	var req = https.request(options, callback);
	req.end(content);

	return req;
};

GCM.prototype.add = function (device, content, messageId) {
	if (!util.isArray(device)) {
		device = [device];
	}
	this.notifications.push([device, content, messageId]);
};

module.exports = GCM;