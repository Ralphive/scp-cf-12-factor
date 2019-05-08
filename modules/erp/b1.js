module.exports = {
    GetBusinessPartners: function (options, response) {
        return (GetBusinessPartners(options, response));
    },
    PostBusinessPartners: function (options, body, response) {
        return (PostBusinessPartners(options, body, response));
    }
}

const SLServer = process.env.B1_SERVER_ENV + ":" + process.env.B1_SLPORT_ENV + process.env.B1_SLPATH_ENV;

const request = require('request')  // HTTP Client
const moment = require('moment') // Date Time manipulation
const redis = require("redis")

function ServiceLayerRequest(options, callback) {

    console.log("Preparing Service Layer Request:" +JSON.stringify(options.method) +" - "+JSON.stringify(options.url))

    getCookiesCache().then(function (cookies) {
        options.headers = { 'Cookie': cookies };

        request(options, function (error, response, body) {
            if (error) {
                console.error(error.message)
            } else {
                if (response.statusCode == 401) {
                    //Invalid Session
                    Connect().then(function () {
                        ServiceLayerRequest(options, callback)
                    }).catch(function (error, response) {
                        callback(error, response)
                    })
                    console.log("Request response with status: " + response.statusCode +
                        "\nRequest headers: " + JSON.stringify(response.headers))
                }
            }
            callback(error, response, body);
        });
    })
        .catch(function () {
            Connect().then(function () {
                ServiceLayerRequest(options, callback)
            }).catch(function (error, response) {
                callback(error, response)
            })
        })
}

let Connect = function () {
    return new Promise(function (resolve, reject) {
        var uri = SLServer + "/Login"
        var resp = {}

        //B1 Login Credentials
        var data = {
            UserName: process.env.B1_USER_ENV,
            Password: process.env.B1_PASS_ENV,
            CompanyDB: process.env.B1_COMP_ENV
        };

        //Set HTTP Request Options
        options = { uri: uri, body: JSON.stringify(data), timeout: 10000 }
        console.log("Connecting to SL on " + uri);

        //Make Request
        request.post(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log("Connected to SL Succeeded!")
                body = JSON.parse(body)
                setCookiesCache(response.headers['set-cookie'], function () {
                    setSLSessionTimeout(body.SessionTimeout)
                    resolve();
                });

            } else {
                console.error("Connection to Service Layer failed. \n" + error)
                reject(error, response);
            }
        });

    })

}

function GetBusinessPartners(options, callback) {
    
}

function PostBusinessPartners(options, body, callback) {

    
}

let getCookiesCache = function () {
    return new Promise(function (resolve, reject) {

        redis.hget(hash_Timeout, timout_exp, function (error, expire) {
            if (moment().isAfter(expire)) {
                //SessionID cached is expired or Doesn't Exist
                console.log("Cached SL Session ID Expired")
                reject()
            } else {
                redis.lrange(hash_Session, 0, -1, function (err, cookies) {
                    if (cookies.length > 0) {
                        console.log("Cached SL Session Retrieved")
                        resolve(cookies)
                    } else {
                        console.log("Cached SL not found")
                        reject();
                    }
                });
            }
        })
    })
}

function setCookiesCache(cookies, callback) {
    // Dump Previous SL Session ID Cache and creates a new one
    redis.del(hash_Session, function () {
        redis.rpush(hash_Session, cookies, function () {
            console.log("Storing SL Session ID in cache")
            callback();
        });
    })
}

function setSLSessionTimeout(timeout) {
    //Store the Session Timeout
    redis.hset(hash_Timeout, hash_Timeout, timeout)

    //Calculates and store when session will be expired
    var expire = moment(moment.now()).add(timeout, 'minutes')
    redis.hset(hash_Timeout, timout_exp, expire.format())

}

function updateSLSessionTimeout() {
    //Calculates and store when session will be expired
    console.log("Updating SL Session Expiration date in cache")
    redis.hget(hash_Timeout, hash_Timeout, function (error, reply) {
        if (error) {
            console.error("Can't Update Session Timeout in Redis " + error)
        } else {
            var expire = moment(moment.now()).add(reply, 'minutes')
            redis.hset(hash_Timeout, timout_exp, expire.format())
        }
    })
}