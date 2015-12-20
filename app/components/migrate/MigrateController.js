/**
 * Created by mkahn on 10/13/15.
 */

app.controller("migrateController",
    function ($q, $scope, $timeout, $log, $rootScope, $route,
              drupal, cmsModel, fileDialog, userDefaults, migrate) {

        $log.info("Loading migrateController");

        var SKIP_DONE = true;

        $scope.ready = false;
        $scope.readyToMigrate = false;
        $scope.ui = {
            status: "", running: false, message: "", showButton: true,
            ntitle: "", nid: "", migrating: false,
            fname: "", ftype: "", fsize: "", uploading: false
        };

        // indicates what has and has not been migrated
        $scope.m = {
            images: false, videos: false, quotes: false, files: false,
            demos: false, pres: false, topic: false, exp: false
        };

        var nidFile = 'nids.json';   // file to save nid pairs to
        var pinFile = 'pins.json';   // file to save file/pin ref pairs to
        var slash = (process.platform === "win32") ? "\\" : "/";  // check if windows - windows will
                                                                  // give 'win32' even if it is 64-bit

        //Keep track of nodes that have already been finished so we don't retry them
        var finishedNodes = userDefaults.getObjectForKey("finishedNodes", []);

        var types = ["image_with_caption", "video_component",
            "quote_component", "file_asset", "live_demo_component",
            "presentation_asset", "topic_template", "experience"];

        var orderedTypes = ["image_with_caption", "video_component",
            "quote_component", "file_asset", "live_demo_component",
            "presentation_asset", "topic_template", "experience"];

        var typeIdx = 0;
        $scope.type = types[typeIdx];

        $scope.cms = {url: undefined, username: undefined, pwd: undefined};
        $scope.snapshot = {dir: ""};

        $scope.snapshot.dir = userDefaults.getStringForKey("snapshotDir", "");

        $scope.logout = function() {
            drupal.logout()   // logout of current CMS
                .then(function () {
                    $log.info("Drupal logout successful.");
                    $scope.readyToMigrate = false;
                }, function () {
                    $log.error("Drupal logout unsuccessful.");
                    $scope.readyToMigrate = false;
                });
        };

        drupal.logout()   // logout of current CMS
            .then(function () {
                $log.info("Drupal logout successful.");
                $scope.ready = true;
            }, function () {
                $log.error("Drupal logout unsuccessful.");
                $scope.ready = true;
            });

        $scope.cms.url = userDefaults.getStringForKey('destCMS', "https://visacms.heliosinteractive.com/drupal");
        drupal.setDrupalUrl($scope.cms.url);

        //Opens file dialog to pick source dir
        $scope.chooseDir = function () {
            fileDialog.openDir(function (dirName) {
                $timeout(function () {
                    $scope.snapshot.dir = dirName;
                });
                userDefaults.setStringForKey("snapshotDir", dirName);
            })
        };

        $scope.authorize = function () {
            $scope.ui.message = "";
            userDefaults.setStringForKey('destCMS', $scope.cms.url);
            drupal.setDrupalUrl($scope.cms.url);
            drupal.clearToken();
            drupal.login($scope.cms.username, $scope.cms.pwd);
        };

        $scope.reload = function() {
            $route.reload();
        };

        $scope.$on('authOK', function () {
            $scope.globalUser = drupal.getUser();
            $scope.ui.message = "Logged in as: " + $scope.globalUser.user.name;
            $scope.readyToMigrate = true;
        });

        $scope.$on('badUser', function () {
            $scope.ui.message = "Error logging in. Unrecognized username or password.";
        });


        $scope.migrateType = function(type) {
            orderedTypes = [type];
            $scope.begin();
        };


        $scope.begin = function () {
            $scope.ui.running = true;
            $scope.ui.showButton = false;

            finishedNodes = userDefaults.getObjectForKey("finishedNodes", []);

            if (!userDefaults.getStringForKey("snapshotDir", "")) {

                //You get here if the user did not pick a snapshot dir
                drupal.logout()

                    .then(function () {
                        $timeout(function () {
                            $scope.ui.running = false;
                            $scope.ui.status = "It looks like no snapshot has been saved!"
                                + " Please save a snapshot before you migrate to version 1.2.";
                        });

                    }, function () {   // drupal logout was unsuccessful
                        $log.error("Error logging out of drupal");
                        $timeout(function () {
                            $scope.ui.running = false;
                            $scope.ui.status = "It looks like no snapshot has been saved!"
                                + " Please save a snapshot before you migrate to version 1.2.";
                        });
                    });
            }

            else {

                migrateAll(orderedTypes)

                    .then(function () {

                        $timeout(function() {
                            $scope.ui.migrating = false;
                            $scope.ui.uploading = false;
                        });

                        typeIdx += orderedTypes.length;

                        if (typeIdx < types.length) {
                            $timeout(function() {
                                $scope.type = types[typeIdx];
                                $scope.ui.status = "";
                                $scope.ui.running = false;
                                $scope.ui.showButton = true;
                            });
                        }

                        else {

                            drupal.logout()

                                .then(function () {
                                    $timeout(function () {
                                        $scope.ui.running = false;
                                        $scope.ui.status = "Migration done! Now the video files must be uploaded manually.";
                                    })

                                }, function () {   // drupal logout was unsuccessful
                                    $timeout(function () {
                                        $scope.ui.running = false;
                                        $scope.ui.status = "Migration done, but logout from the "
                                            + "destination CMS was unsuccessful.";
                                    })
                                });
                        }

                    }, function (err) {   // migration returned an error

                        $scope.ui.migrating = false;
                        $scope.ui.uploading = false;

                        drupal.logout()

                            .then(function () {
                                $timeout(function () {
                                    $scope.ui.running = false;
                                    switch (err) {

                                        case "NO_SNAPSHOT":
                                            $timeout(function () {
                                                $scope.ui.status = "It looks like no snapshot has been saved!"
                                                    + " Please save a snapshot before you migrate to version 1.2.";
                                            });
                                            break;

                                        case "READ_ERR":
                                            $timeout(function () {
                                                $scope.ui.status = "There was an issue reading the snapshot."
                                                    + " Make sure your snapshot is up-to-date.";
                                            });
                                            break;

                                        case "SAVE_ERR":
                                            $timeout(function () {
                                                $scope.ui.status = "Error saving new version.";
                                            });
                                            break;

                                        case "TYPE_ERR":
                                            $timeout(function () {
                                                $scope.ui.status = "Unsupported node type detected.";
                                            });
                                            break;

                                        case "MIGRATE_ERR":
                                            $timeout(function () {
                                                $scope.ui.status = "Error migrating. "
                                                    + "Make sure you migrate simple nodes first.";
                                            });
                                            break;

                                        default:
                                            $timeout(function () {
                                                $scope.ui.status = "Error occurred.";
                                            });
                                            break;
                                    }
                                })
                            }, function () {   // drupal logout was unsuccessful
                                $timeout(function () {
                                    $scope.ui.running = false;
                                    $scope.ui.status = "Error migrating and error logging out "
                                        + "of destination CMS.";
                                })
                            })
                    })
            }
        };


        function migrateAll(types) {
            var p = $q.when();

            types.forEach(function (type) {
                p = p
                    .then(function () {

                        $timeout(function () {
                            $scope.ui.migrating = false;
                            $scope.ui.status = "Fetching all " + type + " nodes...";
                        });

                        return fetchNodes(type)
                            .then(function (nodes) {
                                $timeout(function () {
                                    $scope.ui.migrating = true;
                                    $scope.ui.status = "Migrating " + type + " nodes...";
                                });
                                return migrateNodes(nodes);
                            })
                    })
            });

            return p;
        }


        function fetchNodes(type) {
            var deferred = $q.defer();
            var dir = userDefaults.getStringForKey("snapshotDir", "");
            var nodes = [];
            var obj;

            dir += dir.slice(-1) == slash ? '' : slash;
            dir += type + slash;

            fs.readdir(dir, function (err, files) {

                //TODO: Logic error here. If there is no folder for a particular type (e.g. file_asset) then the
                //app crashes
                if (err) {
                    $log.error("Error reading files in directory " + dir);
                    nodes = [];
                }

                else {
                    files.forEach(function (file) {
                        if (file.slice(-5) == ".json") {
                            obj = jsonfile.readFileSync(dir + file);

                            if (!obj) {
                                $log.error("Error reading file " + dir + file);
                                deferred.reject("READ_ERR");
                            }

                            else {
                                nodes.push(obj);
                            }
                        }
                    });
                    deferred.resolve(nodes);
                }
            });

            return deferred.promise;
        }


        function migrateNodes(nodes) {
            var p = $q.when();

            nodes.forEach(function (node) {
                p = p
                    .then(function () {
                        return migrateNode(node);
                    })
            });

            return p;
        }


        function dispUploadStatus(node, field) {
            if (node[field] && node[field].und) {
                $timeout(function () {
                    $rootScope.uploadProgress = 0;
                    $scope.ui.fname = node[field].und[0].filename;
                    $scope.ui.ftype = node[field].und[0].filemime;
                    $scope.ui.fsize = Math.ceil(node[field].und[0].filesize / 1000000);
                    $scope.ui.uploading = true;
                })
            }
        }


        function migrateNode(rawNode) {
            var deferred = $q.defer();

            var alreadyDone = _.includes(finishedNodes, rawNode.nid);

            if (alreadyDone && SKIP_DONE) {

                $timeout(function () {
                    $scope.ui.ntitle = rawNode.title + " (DONE- Skipping)";
                    $scope.ui.nid = rawNode.nid;
                });

                deferred.resolve();

            } else {

                $timeout(function () {
                    $scope.ui.ntitle = rawNode.title;
                    $scope.ui.nid = rawNode.nid;
                });

                switch (rawNode.type) {

                    case "image_with_caption":
                        dispUploadStatus(rawNode, "field_upload_image");
                        break;

                    case "video_component":
                        dispUploadStatus(rawNode, "field_upload_video");
                        break;

                    case "quote_component":
                        dispUploadStatus(rawNode, "field_background_image");
                        break;

                    case "file_asset":
                        dispUploadStatus(rawNode, "field_file");
                        break;

                    default:
                        break;
                }

                migrate.doMigration(rawNode)

                    .then(function () {
                        $scope.ui.uploading = false;
                        finishedNodes.push(rawNode.nid);
                        userDefaults.setObjectForKey('finishedNodes', finishedNodes);
                        $log.info("Finishing up node: " + rawNode.nid);

                        return migrate.saveDicts(nidFile, pinFile)

                            .then(function () {
                                deferred.resolve();

                            }, function (err) {
                                $log.error("Error saving dicts to file: " + err);
                                deferred.resolve();
                            })

                    }, function (err) {
                        $scope.ui.uploading = false;

                        switch (err) {

                            case "READ_ERR":
                                $log.error("There was an issue reading the snapshot."
                                    + " Make sure your snapshot is up-to-date for node: " + rawNode);
                                deferred.resolve();
                                break;

                            case "SAVE_ERR":
                                $log.error("Error saving new version for node: " + rawNode);
                                deferred.resolve();
                                break;

                            case "TYPE_ERR":
                                $log.error("Unsupported node type detected: " + rawNode.type);
                                deferred.resolve();
                                break;

                            case "MIGRATE_ERR":
                                $log.error("Error migrating node: " + rawNode);
                                deferred.resolve();
                                break;

                            default:
                                deferred.reject(err);
                                break;
                        }
                    });

            }


            return deferred.promise;
        }

    });