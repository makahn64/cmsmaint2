angular.module('superagent.service', [])
    .factory('superagent', function ($q) {

        var service = {};

        var agent = require('superagent');
        var fs = require('fs');

        var sessionId, sessionName, token;

        //Bypass security checking of TLS cert
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

        /**
         * Sets the necessary information from a given drupal user status
         * object with the attributes of the _userStatus object in
         * ngDrupalServicesLite.
         *
         * @param drupalUserStatus
         */
        service.setDrupalUser = function(drupalUserStatus) {
            sessionId = drupalUserStatus.user.sid;
            sessionName = drupalUserStatus.sessionName;
            token = drupalUserStatus.token;
        };


        /**
         * Gets file from src and pipes to dest.
         *
         * @param src
         * @param dest
         * @returns {*}
         */
        service.getFileAndPipe = function (src, dest) {
            var deferred = $q.defer();

            // need to do two GETs in order to show GET error, if present
            agent
                .get(src)
                .set('X-CSRF-Token', token)
                .set('Cookie', sessionName + '=' + sessionId)
                .end(function(err, res) {

                    if (err || !res.ok) {
                        deferred.reject(res.status + ' error getting file at ' + src);
                    } else {
                        var stream = fs.createWriteStream(dest);
                        var req = agent
                            .get(src)
                            .set('X-CSRF-Token', token)
                            .set('Cookie', sessionName + '=' + sessionId);

                        req.pipe(stream)
                            .on('error', function() {
                                deferred.reject('Error writing ' + src + ' to ' + dest);
                            })
                            .on('finish', function() {
                                deferred.resolve('Writing file to ' + dest + ' successful');
                            });
                    }
                });

            return deferred.promise;
        };


        return service;

    });