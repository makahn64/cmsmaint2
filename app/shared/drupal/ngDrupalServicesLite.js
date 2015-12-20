/**
 * Drupal HTTP Calls Wrapper
 *
 *  Services Module Version
 *
 *  New version for CMS Rev 1.2
 *  Lite Version for use in NWK Client Apps
 *
 */

/*

 DEPRECATION PARTY!!!

 fetchFullFiles is probably not needed. It does not appear anywhere else in the code.
 fetchFilesFast
 service.getTree
 removeAttachedFile
 */

angular.module('ngDrupal', [])
    .factory('drupal', function ($http, $q, $rootScope, $window, $timeout, $log) {


        var slashPrivate = '';
        var slashPublic = '';
        var drupalPath = '';
        var apiPath = '';


        var _userState = {
            token: undefined,
            loggedIn: false,
            uid: undefined,
            sessionName: undefined,  // AT: added to pass info to superagent
            user: undefined  //Drupal object with everything in it
        };


        var service = {};

        service.setDrupalUrl = function (url) {
            drupalPath = url;
            if (drupalPath.substr(drupalPath.length - 1) != '/')
                drupalPath = drupalPath + '/';
            apiPath = drupalPath + "api/v2/";
            slashPrivate = drupalPath + 'system/files/';
            slashPublic = drupalPath + 'sites/default/files/';
        }

        service.bypassAuth = false; //for testing

        service.taxonomyDictionary = {};


        /* REWRITTEN FOR 1.2 */

        /* Broadcasts for state */

        function broadcastBadLogin() {
            $rootScope.$broadcast("badUser");
            clearCurrentUserState();
        }

        function broadcastLoggedIn() {
            $rootScope.$broadcast("userLogIn");
        }

        function broadcastLoggedOut() {
            $rootScope.$broadcast("userLogOut");
        }

        function broadcastAuthOK() {
            $rootScope.$broadcast("authOK");
        }

        function getCurrentUserState() {

            var sUser = localStorage.getItem('$$userState');
            if (sUser) {
                return JSON.parse(sUser);
            } else {
                return undefined;
            }
        }

        function setCurrentUserState(userState) {

            var us = userState || _userState;
            localStorage.setItem('$$userState', JSON.stringify(us));
        }

        function clearCurrentUserState() {
            localStorage.removeItem('$$userState');
        }

        /**
         * Grabs the token after a successful Drupal login, saves
         * it in the service and modifies the common header.
         * @returns {r.promise|promise|x.ready.promise}
         */

        function getToken() {

            return $http.get(drupalPath + 'services/session/token')
                .then(function (data) {
                    $http.defaults.headers.common["X-CSRF-Token"] = data.data;

                    // AT: added to pass info to superagent
                    _userState.token = data.data;

                    return true;
                })

        }

        service.getToken = function(){

            return getToken();
        }

        function processUser(drupalUserObject) {

            _userState.user = drupalUserObject.data.user;

            // AT: added to pass info to superagent
            _userState.sessionName = drupalUserObject.data.session_name;

            var roles = _userState.user.roles;
            var anon = _.contains(roles, "anonymous user");

            $log.info('ngDS: ' + ( anon ? 'User is anonymous!' : 'User is logged in OK' ));

            if (anon) {
                broadcastLoggedOut();
                _userState.loggedIn = false;
            } else {
                broadcastAuthOK();
                _userState.loggedIn = true;
            }

            setCurrentUserState();
            return _userState;

        }

        /**
         * Gets the logged in user
         * @returns {*}
         * @private
         */

        service._getLoggedInUser = function () {

            var endpoint = apiPath + 'system/connect';
            return $http.post(endpoint)
                .then(function (user) {

                    $log.info("User is...");
                    $log.info(user);
                    return user;
                })
                .catch(function (err) {

                    $log.error("Got no user...");
                    $log.error(err);
                })
                .then(processUser);

        }

        function setNewTokenFromLogin(res) {

            $http.defaults.headers.common["X-CSRF-Token"] = _userState.token = res.data.token;

        }

        service.clearToken = function(){

            delete $http.defaults.headers.common["X-CSRF-Token"];
        }

        /**
         * Primary method of checking auth for the app
         * @returns {boolean}
         */
        service.isLoggedIn = function () {
            return _userState.loggedIn;
        }

//This is the normal way to get the user status
//TODO: Error cases

        service.getUserStatus = function () {

            return getToken().then(service._getLoggedInUser);

        }

        service.getUser = function () {
            return _userState;
        }

        /**
         *
         * Login flow
         *
         * @param username
         * @param password
         * @returns {*}
         */
        service.loginX = function (username, password) {

            //return service.cleanupAuthStatus();

            return logoutOrSkip()
                .then(getToken)
                .then(function () {
                    return $http.post(apiPath + 'users/login.json', {
                        username: username,
                        password: password
                    })
                })
                .then(setNewTokenFromLogin)
                .then(service._getLoggedInUser)
                .then(broadcastLoggedIn)
                .catch(function (err) {
                    broadcastBadLogin();
                    throw new Error("Bad login. Status: " + err.status);
                });

        }

        service.login = function (username, password) {

            return $http.post(apiPath + 'users/login.json', {
                username: username,
                password: password
            })
                .then(setNewTokenFromLogin)
                .then(service._getLoggedInUser)
                .then(broadcastLoggedIn)
                .catch(function (err) {
                    broadcastBadLogin();
                    throw new Error("Bad login. Status: " + err.status);
                });

        }

        //NWK seems to hold on to auth stuff like childhood issues, we need a cleaning breath
        service.cleanupAuthStatus = function(){

            //Step 1: Who the fuck am I?

            return getToken()
                .then(service._getLoggedInUser)

            //Step 2: Log the fuck out
                .then(logoutOrSkip);

        }

        /**
         * Performs a logout
         */
        function logout() {

            return $http.post(apiPath + 'users/logout')
                .then(service._getLoggedInUser)
                .then(broadcastLoggedOut);

        }

        function logoutOrSkip(){

            return $http.post(apiPath + 'users/logout')
                .then(function(data){
                    $log.info("LogoutorSkip logged out ok.");
                    return true;
                })
                .catch(function(err){
                    $log.error("LogoutorSkip had a problem but we are squashing it");
                    $log.error("Details: "+err);
                    return true;
                });


        }


        /**
         * Uses filter API call to get a list of nodes, then does individual
         * Services calls to get the entirety of each node.
         *
         * Used in V1.2
         *
         * @param type
         * @returns {r.promise|promise|x.ready.promise}
         */

        function getFullNodesOfType(type) {

            $log.info('ngDS: getFullNodesOfType ' + type);
            var rnodes = [];
            var uNodeType = encodeURI(type);
            var endpoint = apiPath + "nodes?pagesize=10000&parameters[type]=" + uNodeType;

            return $http.get(endpoint).then(
                function (data) {
                    var nodes = data.data;
                    var ncount = nodes.length;
                    if (ncount == 0) {
                        return rnodes;
                    } else {

                        var promiseArr = [];
                        nodes.forEach(function (node) {
                            var ep = apiPath + "nodes/" + node.nid + ".json";
                            promiseArr.push($http.get(ep).then(function (d) {
                                return d.data;
                            }));
                        })

                        return $q.all(promiseArr);

                    }


                });

        }

        /**
         *
         * This is the main getter for an array of node types.
         *
         * Used in V1.2
         *
         * Uses filter API call to get a list of nodes, then does individual
         * Services calls to get the entirety of each node.
         * @param type
         * @returns {r.promise|promise|x.ready.promise}
         */
        service.fetchFullNodes = function (nodeType) {

            return getFullNodesOfType(nodeType);

        }


        /**
         * Uses filter API call to get a list of files, then does individual
         * Services calls to get the entirety of each file.
         * @param type
         * @returns {r.promise|promise|x.ready.promise}
         */

        function fetchFullFiles() {

            //TODO: delte method enitrely if the below throw never happens in testing!
            throw new Error("Hmm, guess drupal.fetchFullFiles *is* used");

            /*
             //TODO delete me after regression
             var def = $q.defer();
             var rfiles = [];

             var endpoint = apiPath + "files?pagesize=10000";

             $http.get(endpoint).then(
             function (res) {
             var files = res.data;
             var fcount = files.length;
             files.forEach(function (file) {
             var ep = apiPath + "files/" + file.fid;
             $http.get(ep).then(
             function (res) {
             rfiles.push(res);
             fcount--;
             if (fcount == 0) {
             def.resolve(rfiles);
             }
             },
             function (res) {
             fcount--;
             if (fcount == 0)
             def.resolve(rfiles);
             })
             })
             },
             function (res) {
             handleHTTPError(res, def, 'Failure getting files.');
             }
             )

             return def.promise;
             */

            var rfiles = [];

            var endpoint = apiPath + "files?pagesize=10000";

            return $http.get(endpoint).then(
                function (res) {
                    var files = res.data;
                    var fcount = files.length;
                    files.forEach(function (file) {
                        var ep = apiPath + "files/" + file.fid;
                        $http.get(ep)
                            .then(function (res) {
                                rfiles.push(res);
                                fcount--;
                                if (fcount == 0) {
                                    return rfiles;
                                }
                            })
                            .catch(function (res) {
                                $log.warn("ngDrupal: error fetching one of many files, ignoring and moving on.");
                                fcount--;
                                if (fcount == 0)
                                    return rfiles;
                            })
                    })
                });
        }

        /**
         * Uses filter API call to get a list of files, then does individual
         * Services calls to get the entirety of each file.
         * @param type
         * @returns {r.promise|promise|x.ready.promise}
         */

//TODO probably DEPRECATE
        function fetchFilesFast() {

            throw new Error("Guess drupal.fecthFilesFast is used after all!");

            var def = $q.defer();
            var rfiles = [];

            var endpoint = apiPath + "files?pagesize=10000";

            doHttpGetOp(endpoint).then(
                function (res) {
                    var files = res;
                    def.resolve(files);
                },
                function (res) {
                    handleHTTPError(res, def, 'Failure in fetch files fast.');
                }
            )

            return def.promise;
        }

        /**
         *
         * Fetch all active taxonomies and their terms
         *
         */

        /******************************************************
         *
         *  In 1.2, taxonomies have a JDOC endpoint and come down as an array of
         *  { term: 'USA', taxonomy: "geographic_countries", tid: 32 }
         *
         ******************************************************/

            //Rewritten for deprecated methods
        service.loadTaxonomies = function () {

            var ep = apiPath + 'taxonomies';
            return $http.get(ep).then(
                function (data) {
                    var terms = data.data.nodes;
                    service.taxonomyDictionary = {}; // clear it out
                    terms.forEach(function (termNode) {
                        var term = termNode.node;
                        if (service.taxonomyDictionary[term.machine_name] === undefined) {
                            service.taxonomyDictionary[term.machine_name] = [];
                        }
                        service.taxonomyDictionary[term.machine_name].push(term);

                    });
                    return service.taxonomyDictionary;
                });

        }

//On DEPRECATION watch
        service.getTree = function (vocabId) {

            throw new Error("Guess ngDrupal.getTree is used");
            var ep = apiPath + 'taxonomy_vocabulary/getTree';
            var params = {vid: vocabId};
            var d = $q.defer();

            doHttpPxxOp(ep, 'POST', params).then(
                function (data, status) {
                    d.resolve(data, status);
                },
                function (err) {
                    handleHTTPError(err, d, 'Failure fetching taxonomy tree');
                });

            return d.promise;

        }

        /**
         * Gets Services-Based summary info about nodes of a given type or all nodes.
         * This call returns ONLY base Drupal node info, no other fields.
         * @param nodeType
         * @returns {*}
         */
        service.fetchNodes = function (nodeType) {

            if (nodeType === undefined || nodeType == "") {
                //var endpoint = drupalPath+"/api/v1/nodes?pagesize=10000";
                var endpoint = apiPath + "nodes?pagesize=100000";
            } else {
                var uNodeType = encodeURI(nodeType);
                //var endpoint = drupalPath+"/api/v1/nodes?pagesize=10000&type="+uNodeType;
                var endpoint = apiPath + "nodes?pagesize=100000&parameters[type]=" + uNodeType;
            }


            return $http.get(endpoint);

        }

        /**
         * Fetches from a Views JSON Doc formatted endpoint in the form
         * [api-endpoint]/jdoc/[machine name]/summary
         * This endpoint is created manually thru Views.
         *
         * "Labels" in the View MUST match the machine field name exactly
         * for the JDOC parser to work correctly in the model.
         *
         * @param nodeType
         *
         * DEFINITELY USED IN 1.2!!!
         *
         */
        service.fetchJSONDocNodeSummary = function (nodeType) {

            var endpoint = apiPath + "jdoc/" + nodeType + "/summary";

            return $http.get(endpoint)
                .then(function (data) {
                    var rval = [];
                    // Struct like { nodes: [ { node: { useful shit }, ..]}
                    // So we gotta pull that shit out
                    var narr = data.data.nodes;
                    narr.forEach(function (turd) {
                        rval.push(turd.node);
                    });
                    return rval;
                })
                .catch(function (err) {
                    $log.error("ngDS: error fetching node summary");

                    //TODO this is probably horribly fucked ---> 'this'
                    //handleHTTPError(err, this, "Fetching JSON Doc node summaries for " + nodeType + ".");

                }
            )

        }


//DEPRECATE
        service.fetchFilesFast = function (nodeType) {

            return fetchFilesFast();

        }

        /**
         * Slimmed down error handler in 1.2.
         *
         * @param err
         */
        function processHttpError(err) {

            switch (err.status) {

                case 403:
                    $log.error("ngDS: 403 on that last access sparky! Forcing deauth.");
                    if (!service.bypassAuth) {
                        logout();
                    }
                    break;

            }
        }


        /**
         * New 1.2 version
         *
         * @param nodeId
         * @returns {d.promise}
         *
         * THIS CODE IS DEFINITELY USED IN 1.2 HOMEY
         *
         */

        service.fetchNode = function (nodeId) {

            var endpoint = apiPath + "nodes/" + nodeId + ".json";

            return $http.get(endpoint);

            /*
             //TODO this passing back promise with local catch feels wonky

             .catch(function (err) {
             $log.error("ngDS: error fetching node");
             processHttpError(err);
             //Throw that shit upstream
             throw new Error("Could not fetch node! Status: " + err.status);
             }
             */


        }

//TODO DEPRECATE
        service.fetchFile = function (fid) {

            throw new Error("Guess drupal.fetchFile is used after all");

            //old method returns data too, we don't really need that and
            //it breaks with .bin files
            var endpoint = apiPath + "files/" + fid;

            var d = $q.defer();

            doHttpGetOp(endpoint).then(
                function (data, status) {
                    d.resolve(data, status);
                },
                function (err) {
                    handleHTTPError(err, d, 'Failure fetching file');
                });

            return d.promise;

        }

        /**
         * Only returns basic info like filename and file endpoint path
         * Used for file_assets mostly
         * @param fid
         * @returns {r.promise|promise|x.ready.promise}
         */
        service.fetchFileLight = function (fid) {

            throw new Error("Guess drupal.fetchFileLight is used after all");

            var d = $q.defer();
            var endpoint = apiPath + 'files?parameters[fid]=' + fid;
            doHttpGetOp(endpoint).then(
                function (data, status) {
                    d.resolve({data: data[0], status: status});
                },
                function (err) {
                    handleHTTPError(err, d, 'Failure fetching file (lite).');
                }
            );

            return d.promise;
        }

        service.fetchFullFiles = function () {

            throw new Error("Guess drupal.fecthFullFiles is used after all");

            return fetchFullFiles();

        }


        /***********************************************************************************************
         *
         * METHODS UPDATED AND TESTED FOR VERSION 1.2
         *
         ***********************************************************************************************/

        function relay(data) {
        }


        /**
         *
         * Used in Version 1.2
         *
         * @param node
         * @returns {*}
         */
        service.postNode = function (node) {

            var endpoint = apiPath + "nodes";
            node.uid = getCurrentUserState().user.uid;

            delete node.nid; // in case it's hanging on there

            return $http.post(endpoint, node);

            /*

             //Commented out to let the error bubble

             .catch(function (err) {
             $log.error("ngDS: error creating node");
             processHttpError(err);
             //Throw that shit upstream
             throw new Error("Could not create node! Status: " + err.status);
             });
             */
        }


        /**
         *
         * Used in Version 1.2
         *
         * @param node
         * @returns {*}
         */
        service.updateNode = function (node) {

            var endpoint = apiPath + "nodes/" + node.nid + ".json";

            return $http.put(endpoint, node);

            /*

             //Commented out to let the error bubble up.
             .catch(function (err) {
             $log.error("ngDS: error updating node");
             processHttpError(err);
             //Throw that shit upstream
             throw new Error("Could not update node! Status: " + err.status);
             });
             */

        }


        /**
         *
         * Should be OK for use in 1.2
         *
         * @param node
         * @returns {jQuery.promise|promise.promise|d.promise|promise|.ready.promise|jQuery.ready.promise|*}
         */

            //------------ left off here

        service.createOrUpdateNode = function (node) {

            //var def = $q.defer();

            if ((node.nid == undefined) || (node.nid == 0)) {
                return service.postNode(node);
                /*
                 .then(

                 function (robj) {
                 console.log("Node saved: " + robj);
                 def.resolve(robj);
                 },
                 function (adErr) {
                 console.log("Failed to save node!  Error: " + adErr.message);
                 def.reject(adErr);
                 });
                 */

            } else {
                service.updateNode(node)
                /*.then(
                 function (robj) {
                 console.log("Node updated: " + robj);
                 def.resolve(robj);
                 },
                 function (adErr) {
                 console.log("Failed to update node!  Error: " + adErr.message);
                 def.reject(adErr);
                 });
                 */
            }

            //return def.promise;

        }

        /**
         *
         * Fixed for 1.2 deprecations
         *
         * @param nodeId
         * @returns {*}
         */
        service.deleteNode = function (nodeId) {

            var endpoint = apiPath + "nodes/" + nodeId;

            return $http.delete(endpoint);

            /*
             .catch(function (err) {
             $log.error("ngDS: error deleting node");
             processHttpError(err);
             //Throw that shit upstream
             throw new Error("Could not delete node! Status: " + err.status);

             });
             */

        }

        /**
         * Removes attached file from a node
         * @param node
         * @param fieldName
         * @returns {r.promise|promise|x.ready.promise}
         */

            //TODO does this even WORK? Is it even USED?
        service.removeAttachedFile = function (node, fieldName) {

            throw new Error("I guess drupal.removeAttachedFile is used after all");

            var def = $q.defer();

            var fd = new FormData();
            fd.append('field_name', fieldName);
            fd.append('files[]', undefined);
            fd.append('attach', 0);

            $http.post(apiPath + 'nodes/' + node.nid + '/attach_file', fd, {
                transformRequest: angular.identity,
                headers: {'Content-Type': undefined}
            })
                .success(function (data) {
                    console.log("Successfully deleted file");
                    def.resolve();
                })
                .error(function (err) {
                    console.log("FAIL!");
                    //def.reject(data);
                    handleHTTPError(err, def, 'Error removing attached file.');
                });

            return def.promise;

        }

        /**
         * Attaches a file to a node
         * @param file
         * @param node
         * @param fieldName
         * @returns {r.promise|promise|x.ready.promise}
         */
        service.attachFile = function (file, node, fieldName) {

            var fd = new FormData();
            fd.append('field_name', fieldName);
            fd.append('files[]', file, file.name);
            fd.append('attach', 0);

            $timeout(function() {
                $rootScope.uploadProgress = 0;
            });

            //?XDEBUG_SESSION_START=15849
            return $http.post(apiPath + 'nodes/' + node.nid + '/attach_file', fd, {
                transformRequest: angular.identity,
                headers: {
                    'Content-Type': undefined,
                    '__XHR__' : function() {
                        return function(xhr) {
                            xhr.upload.addEventListener("progress", function(event) {
                                $timeout(function() {
                                    $rootScope.uploadProgress =
                                        Math.round((event.loaded / event.total) * 100);
                                });
                            });
                        };
                    }

                }
            })
                .then(function (data) {
                    $log.info("ngDrupal: Successfully uploaded file (attachFile method): "
                        + data.data[0].fid);

                    // AT: added to fix issue with multiple saving nodes with multiple attached files
                    node[fieldName].value = data.data[0];

                    return data.data[0];
                },
                function (err) {
                    $log.error("Not able to upload file. " + err);
                });


        }


        /**
         * Attaches multiple files to a node
         *
         * USED IN 1.2!!!
         *
         * @param file
         * @param node
         * @param fieldName
         * @returns {r.promise|promise|x.ready.promise}
         */

        service.attachFileMulti = function (file, node, fieldName, index) {


            //Original deprecated code commented out below
            /*
             var def = $q.defer();

             //TODO this index=0 may be causing Drupal some indigestion, check it
             if (index === undefined) {
             index = 0;
             }

             var fd = new FormData();
             fd.append('field_name', fieldName);
             fd.append('files[]', file, file.name);
             fd.append('attach', index);

             $http.post(apiPath + 'nodes/' + node.nid + '/attach_file', fd, {
             transformRequest: angular.identity,
             headers: {'Content-Type': undefined}
             })
             .success(function (data) {
             console.log("Successfully uploaded file");
             def.resolve(data[0].fid);
             })
             .error(function (err) {
             console.log("Error attaching file multi!");
             handleHTTPError(err, def, 'Error attaching file multi.');
             });

             return def.promise;
             */


            //TODO this index=0 may be causing Drupal some indigestion, check it
            if (index === undefined) {
                index = 0;
            }

            var fd = new FormData();
            fd.append('field_name', fieldName);
            fd.append('files[]', file, file.name);
            fd.append('attach', index);

            return $http.post(apiPath + 'nodes/' + node.nid + '/attach_file', fd, {
                transformRequest: angular.identity,
                headers: {'Content-Type': undefined}
            })
                .then(function (data) {
                    $log.info("ngDrupal: Successfully uploaded file: " + data[0].fid);
                    return data[0].fid;
                });

        }


        /*********************************************************************
         *
         * CLEAN FOR 1.2 ABOVE
         *
         *********************************************************************/


        service.getUid = function () {
            if (currentUser())
                return currentUser().uid;
            else
                return 0;
        }

        service.getUserInfo = function () {
            return currentUser();
        }

        service.canEdit = function (node) {

            var userNode = currentUser();

            if (userNode == undefined)
                return false;

            if (node.uid == 0)
                return true; //new node

            if (userNode.uid == node.uid) {
                return true;
            } else if (_.contains(userNode.roles, 'administrator')) {
                return true;
            } else if (_.contains(userNode.roles, 'supervisor')) {
                return true;
            } else if (_.contains(userNode.roles, 'approver')) {
                return true;
            } else if (_.contains(userNode.roles, 'editor')) {
                return false;
            }

            return false; // failsafe

        }

// In 1.0 (0.7) only approver+ can delete!
        service.canDelete = function (node) {

            var userNode = currentUser();

            if (userNode == undefined)
                return false;

            if (node.uid == 0)
                return true; //new node

            if (_.contains(userNode.roles, 'administrator')) {
                return true;
            } else if (_.contains(userNode.roles, 'supervisor')) {
                return true;
            } else if (_.contains(userNode.roles, 'approver')) {
                return true;
            } else {
                return false;
            }

        }

        service.doLogin = function () {
            $window.location.href = LOGIN_REDIRECT;
        }

        service.logout = function () {

            return logout();

        }

//Feed the watchdog
        service.feed = function () {
            userTimeoutReset();
        }


        /*
         service.getDirectImagePath = function(){
         return dirtyImagePath;
         }
         */

        service.fullPathFor = function (shortUri) {

            //If url starts with http, it is already a full path so do nothing
            if (shortUri.indexOf('https:') > -1 || shortUri.indexOf('http:') > -1) {
                return shortUri;
            }
            var bits = shortUri.split("//");

            if (bits.length != 2)
                return "";

            switch (bits[0]) {
                case 'public:':
                    return slashPublic + bits[1];
                    break;
                case 'private:':
                    return slashPrivate + bits[1];
                    break;
                default:
                    return slashPublic + bits[1];
            }
        }

        /**
         * By default, gives the thumbnail URL for a private file
         * @param mainUrl
         * @param size thumbnail size. Medium is default;
         * @param publicFiles
         * @returns {*}
         */
        service.thumbnailPathFor = function (mainUrl, size, publicFiles) {
            var thumbUrl;

            if (size === undefined) {
                size = 'medium';
            }

            var urlPieces = mainUrl.split("files");
            if (!publicFiles) {

                thumbUrl = urlPieces[0] + "files/styles/" + size + "/private" + urlPieces[1];
            } else {
                thumbUrl = urlPieces[0] + "files/styles/" + size + "/public" + urlPieces[1];
            }

            return thumbUrl;
        }

        service.initialize = function () {

            //var d = $q.defer();
            $log.info('Drupal initialize called.');
            return service.loadTaxonomies();

            /*.then(
             function () {
             d.resolve();
             },
             function (adErr) {
             d.reject(adErr);
             });

             return d.promise;
             */

        }

        /**
         * Useful function from Levi's app. Kept around in case we need it at some point.
         * Converts data URI to a blob in order to upload it as image.
         * @param dataURI
         * @returns {Blob}
         */
        service.dataURItoBlob = function (dataURI) {
            // convert base64/URLEncoded data component to raw binary data held in a string
            var byteString;
            if (dataURI.split(',')[0].indexOf('base64') >= 0)
                byteString = atob(dataURI.split(',')[1]);
            else
                byteString = unescape(dataURI.split(',')[1]);

            // separate out the mime component
            var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

            // write the bytes of the string to a typed array
            var ia = new Uint8Array(byteString.length);
            for (var i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }

            return new Blob([ia], {type: mimeString});
        }

        /**
         * This is from ngSEXXY. Takes a canvas and posts it to SSEXY /protos endpoint
         * Would need to be modded for Drupal. Here in case we need it later.
         * @param canvas
         * @param guestId
         * @param fname
         * @returns {r.promise|promise|x.ready.promise}
         */


        function postCanvasToPhotos(canvas, guestId, fname) {

            //var deferred = $q.defer();

            var dataURL = canvas.toDataURL('image/jpeg', 0.5);
            var blob = dataURItoBlob(dataURL);

            var fd = new FormData();
            fd.append('file', blob, fname);
            fd.append('id', guestId);
            // Content-Type undefined supposedly required here, transformed elsewhere

            return $http.post('/photos', fd, {
                transformRequest: angular.identity,
                headers: {'Content-Type': undefined}
            });

            /*
             .success(function () {
             console.log("Successfully POSTed canvas to photos!");
             deferred.resolve();
             })
             .error(function (data, status) {
             console.log("FAIL POSTing canvas to photos!");
             deferred.reject()

             });

             return deferred.promise;
             */
        }


        return service;

    }
)


/**
 * Modified from 1.1. Needs test.
 */
    .
    directive('drupalThumbImg', [
        'drupal', function (drupal) {
            return {
                restrict: 'A',
                scope: {
                    fileUri: '='
                },
                link: function (scope, element, attrs) {

                    var mainUrl;

                    // if the path-done attibute is set, then the public/private lookup is not necessary
                    if (attrs.pathDone !== undefined) {
                        mainUrl = scope.fileUri;
                    } else {
                        mainUrl = drupal.fullPathFor(scope.fileUri);
                    }

                    attrs.$set('src', drupal.thumbnailPathFor(mainUrl));

                    element.bind('error', function () {
                        console.log("Failed to load thumbnail: " + scope.fileUri);
                        attrs.$set('src', mainUrl);

                    });

                }
            }
        }])


    .directive('drupalVideo', [
        'drupal', function (drupal) {
            return {
                templateUrl: 'partials/templates/drupalvideo.partial.html',
                restrict: 'E',
                scope: {
                    videoField: '='
                },
                link: function (scope, element, attrs) {

                    scope.sourceUrl = "";

                    function loadSrc() {

                        scope.sourceUrl = drupal.fullPathFor(scope.videoField.und[0].uri);

                    }

                    scope.$watch('videoField', function (nval, oval) {

                        console.log("FileId val changed (watch): " + oval + "." + nval);
                        if (nval === undefined || nval.und === undefined) {
                            console.log("Undefined video field, go away homey.");
                            return;
                        }

                        loadSrc();

                    })


                }
            }
        }])

    .directive('drupalFilename', [
        'drupal', function (drupal) {
            return {
                restrict: 'E',
                template: '<div>{{fname}}</div>',
                scope: {
                    fileId: '='
                },
                link: function (scope, element, attrs) {

                    function load() {

                        if (scope.fileId == undefined) {
                            scope.fname = 'none';
                            return;

                        }

                        console.log("Fetching file: " + scope.fileId);


                        drupal.fetchFileLight(scope.fileId).then(
                            function (data) {
                                scope.fname = data.filename;
                            },
                            function (data) {
                                scope.fname = 'error';
                            });
                    }

                    load();

                    scope.$watch('fileId', function (nval, oval) {

                        console.log("FileId val changed (watch): " + oval + "." + nval);
                        load();

                    })


                }
            }
        }])

    .directive('drupalUri', [
        'drupal', function (drupal) {
            return {
                restrict: 'A',
                scope: {
                    fileUri: '=',
                    placeHolder: '='
                },
                link: function (scope, element, attrs) {

                    function createUrl() {
                        console.log("Fetching URL for file: " + scope.fileUri);
                        attrs.$set('src', scope.placeHolder);
                        if (scope.fileUri == undefined)
                            return;
                        var fullUrl = drupal.fullPathFor(scope.fileUri);

                        if (fullUrl == "" || fullUrl == undefined) {
                            return;
                        }

                        attrs.$set('src', fullUrl);

                    }

                    scope.$watch('fileUri', function (nval, oval) {

                        console.log("DrupalUri val changed (watch): " + oval + "." + nval);
                        createUrl();

                    })


                }
            }
        }])

    .directive('drupalVideoSrc', [
        'drupal', function (drupal) {
            return {
                restrict: 'A',
                scope: {
                    fileId: '='
                },
                link: function (scope, element, attrs) {

                    function loadVideo() {
                        console.log("Fetching video file: " + scope.fileId);
                        //attrs.$set('src', 'img/icons/hex-loader2.gif');
                        if (scope.fileId == undefined)
                            return;
                        drupal.fetchFile(scope.fileId).then(
                            function (data) {
                                attrs.$set('src', data.uri_full);
                            },
                            function (data) {
                                //attrs.$set('src', 'img/icons/imgmissing.png');
                            });
                    }

                    scope.$watch('fileId', function (nval, oval) {

                        console.log("FileId val changed (watch): " + oval + "." + nval);
                        loadVideo();

                    })


                }
            }
        }])



