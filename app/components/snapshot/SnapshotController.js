app.controller("snapshotController",
    function ($http, $scope, $timeout, $log, drupal, superagent, fileDialog, userDefaults) {

        $log.info("Loading snapshotController");

        $scope.ready = false;
        $scope.ui = {status: "", running: false};
        $scope.dir = {path: ""};

        var _nodes, _types, _media = [];

        var slash = (process.platform === "win32") ? "\\" : "/";  // check if windows - windows will
                                                                  // give 'win32' even if it is 64-bit
        // check if logged in
        drupal.getUserStatus()
            .then(function () {
                $scope.globalUser = drupal.getUser();
                $scope.ready = true;
            }, function (err) {
                $log.error("Unable to get user status." + err);
                $scope.ready = true;
            });


        /**
         * Allows user to chose a directory and sets the path to that directory.
         */
        $scope.chooseDir = function () {
            fileDialog.openDir(function (dirName) {
                $timeout(function () {
                    $scope.dir.path = dirName;
                });
            })
        };


        /**
         * Starts the process of saving the snapshot by fetching the nodes and
         * then calling processTypes().
         */
        $scope.begin = function () {

            $scope.ui.running = true;
            $scope.ui.status = "";

            userDefaults.setStringForKey("snapshotDir", $scope.dir.path);

            if (!$scope.dir.path) {
                $scope.ui.status = "Please specify a name and location for the new directory.";
                $scope.ui.running = false;
                return;
            }

            $scope.dir.path += $scope.dir.path.slice(-1) == slash ? '' : slash;
            $scope.ui.status = "Fetching all nodes...";


            drupal.fetchNodes()
                .then(function (data) {

                    _nodes = data.data;
                    $scope.processTypes();

                }, function (err) {

                    drupal.getUserStatus() // check to make sure session didn't time out
                        .then(function () {
                            $scope.globalUser = drupal.getUser();
                        }, function (err) {
                            $log.error("Unable to get user status." + err);
                        });

                    $log.error("Error loading nodes: " + err);
                    $scope.ui.status = "Error loading nodes.";
                    $timeout(function () {
                        $scope.ui.running = false;
                    });
                });
        };


        /**
         * Finds the types of the nodes and calls createTypeDirs().
         */
        $scope.processTypes = function () {
            _types = [];

            $scope.ui.status = "Creating sub-directories...";

            _nodes.forEach(function (node) {  // get types

                if (!_.includes(_types, node.type)) {
                    _types.push(node.type);
                }
            });

            $scope.createTypeDirs(0, $scope.processNodes);  // create directories
        };


        /**
         * Creates a directory for the type in _types indexed by typeIdx, and calls
         * the callback function when all type directories have been created.
         *
         * @param typeIdx
         * @param callback
         */
        $scope.createTypeDirs = function (typeIdx, callback) {

            if (typeIdx < _types.length) {
                fs.mkdir($scope.dir.path + _types[typeIdx], function (err) {

                    if (err) {

                        $log.error($scope.dir.path + _types[typeIdx] + " " + err);
                        $scope.ui.status = "Error creating sub-directories. Make sure you choose" +
                            " an empty directory to save the snapshot into.";
                        $timeout(function () {
                            $scope.ui.running = false;
                        });
                    }

                    else {
                        $scope.createTypeDirs(++typeIdx, callback);
                    }
                })
            }

            else {   // all type directories are created
                callback(0);
            }
        };


        /**
         * Processes the nodes by saving them as a JSON file to the appropriate directory
         * and adding their media file information to an array for later processing. Once
         * all nodes are processed, processMedia(0) is called.
         *
         * @param nodeIdx
         */
        $scope.processNodes = function (nodeIdx) {
            var relIdx = nodeIdx + 1;
            $scope.ui.status = "Processing node " + relIdx + " out of "
                + _nodes.length + "...";

            if (nodeIdx < _nodes.length) {
                var node = _nodes[nodeIdx];
                var dest = $scope.dir.path + node.type + slash + node.nid + '.json';

                drupal.fetchNode(node.nid)

                    .then(function (data) {

                        // write JSON file
                        fs.writeFile(dest, JSON.stringify(data.data), function (err) {

                            if (err) {
                                $log.error("Error writing to " + dest + ": " + err);
                            }

                            // collect info on media files for later processing
                            switch (node.type) {

                                case "image_with_caption":
                                    try {
                                        _media.push({
                                            src: drupal.fullPathFor(data.data['field_upload_image'].und[0].uri),
                                            dest: $scope.dir.path + node.type + slash
                                            + data.data['field_upload_image'].und[0].filename
                                        });
                                    } catch (err) {
                                        //$log.warn('Node '+ node.nid +' of type ' + node.type +' does not have media.');
                                    }
                                    break;

                                case "video_component":
                                    try {
                                        _media.push({
                                            src: drupal.fullPathFor(data.data['field_upload_video'].und[0].uri),
                                            dest: $scope.dir.path + node.type + slash
                                            + data.data['field_upload_video'].und[0].filename
                                        });
                                    } catch (err) {
                                        //$log.warn('Node '+ node.nid +' of type ' + node.type +' does not have media.');
                                    }
                                    break;

                                case "quote_component":
                                    try {
                                        _media.push({
                                            src: drupal.fullPathFor(data.data['field_background_image'].und[0].uri),
                                            dest: $scope.dir.path + node.type + slash
                                            + data.data['field_background_image'].und[0].filename
                                        });
                                    } catch (err) {
                                        //$log.warn('Node '+ node.nid +' of type '+ node.type +' does not have media.');
                                    }
                                    break;

                                case "file_asset":
                                    try {
                                        _media.push({
                                            src: drupal.fullPathFor(data.data['field_file'].und[0].uri),
                                            dest: $scope.dir.path + node.type + slash
                                            + data.data['field_file'].und[0].filename
                                        });
                                    } catch (err) {
                                        //$log.warn('Node '+ node.nid +' of type '+ node.type +' does not have media.');
                                    }
                                    break;

                                case "presentation_asset":
                                    var images = data.data['field_presentation_images'].und;

                                    if (images) {
                                        for (var i = 0; i < images.length; i++) {
                                            _media.push({
                                                src: drupal.fullPathFor(images[i].uri),
                                                dest: $scope.dir.path + node.type + slash + images[i].filename
                                            });
                                        }
                                    }
                                    else {
                                        //$log.warn('Node '+ node.nid +' of type ' + node.type +' does not have media.');
                                    }
                                    break;

                                case "experience":
                                    try {
                                        _media.push({
                                            src: drupal.fullPathFor(data.data['field_background_image'].und[0].uri),
                                            dest: $scope.dir.path + node.type + slash
                                            + data.data['field_background_image'].und[0].filename
                                        });
                                    } catch (err) {
                                        //$log.warn('Node '+ node.nid +' of type '+ node.type +' does not have media.');
                                    }
                                    break;

                                default:
                                    break;
                            }

                            // get thumbnail if present
                            try {
                                _media.push({
                                    src: drupal.fullPathFor(data.data['field_thumbnail'].und[0].uri),
                                    dest: $scope.dir.path + node.type + slash
                                    + data.data['field_thumbnail'].und[0].filename
                                });
                            } catch (err) {
                                // node does not have thumbnail
                                //$log.warn('Node '+ node.nid +' of type '+ node.type +' does not have media.');
                            }

                            $scope.processNodes(++nodeIdx);
                        })

                    }, function (err) {
                        $log.error("Error fetching node " + node.nid + ": " + err);
                        $scope.processNodes(++nodeIdx);
                    })
            }

            else {   // all nodes have been processed
                $scope.processMedia(0);
            }
        };


        /**
         * Processes all the media files and saves them into their appropriate directory.
         * Calls end() when all media files are processed to indicate that the snapshot
         * has been completed.
         *
         * @param mediaIdx
         */
        $scope.processMedia = function (mediaIdx) {
            var relIdx = mediaIdx + 1;

            superagent.setDrupalUser(drupal.getUser());

            $timeout(function () {
                $scope.ui.status = "Processing media item " + relIdx + " out of "
                    + _media.length + "...";
            });


            if (mediaIdx < _media.length) {
                var mediaItem = _media[mediaIdx];

                superagent.getFileAndPipe(mediaItem.src, mediaItem.dest)

                    .then(
                    function () {
                        $scope.processMedia(++mediaIdx);
                    },
                    function (err) {
                        $log.error(mediaItem.src + " to " + mediaItem.dest + ": " + err);
                        $scope.processMedia(++mediaIdx);
                    });
            }

            else {    // all media items have been processed
                $scope.end();
            }

        };


        /**
         * Adjusts UI to reflect that the snapshot is complete.
         */
        $scope.end = function () {

            $timeout(function () {
                $scope.ui.status = "Snapshot saved to " + $scope.dir.path;
                $scope.ui.running = false;
            });

        }

    });