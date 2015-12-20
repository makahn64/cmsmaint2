angular.module('migrate.service', [])
    .factory('migrate', function ($q, $timeout, $log, drupal, cmsModel, userDefaults) {

        var TEST_MODE = false;  // will not download any media files in test mode

        var slash = (process.platform === "win32") ? "\\" : "/";  // check if windows - windows will
                                                                  // give 'win32' even if it is 64-bit
        var jsonfile = require('jsonfile');
        var util = require('util');

        var _nidDict = {};  // entries are of the form oldNid:newNid
        var _pinDict = {};  // entries are of the form fileId:pinNodeId

        fs.readFile("nids.json", "utf8", function(err, data) {
            if (err) {
                $log.error("Error reading nids.json: " + err);
                _nidDict = {};
            }
            else {
                _nidDict = JSON.parse(data);
            }
        });

        var service = {};

        function linfo(msg){
            $log.info("MIGRATE-svc: "+msg);
        }

        /**
         * Creates a Blob from the saved snapshot file.
         *
         * @param node
         * @param filename
         * @param filetype
         * @returns {*}
         */
        function createBlob(node, filename, filetype) {
            var deferred = $q.defer();

            var parentDir = userDefaults.getStringForKey("snapshotDir", "");

            if (!parentDir) {
                deferred.reject("NO_SNAPSHOT");
            }

            else {
                parentDir += parentDir.slice(-1) == slash ? '' : slash;
                var path = parentDir + node.type + slash + filename;

                fs.readFile(path, function (err, data) {

                    if (err) {
                        $log.error("Error reading file at " + path + ": " + err);

                        deferred.reject("READ_ERR");
                    }

                    else {
                        var ua = new Uint8Array(data);
                        var blob = new Blob([ua.buffer],
                            {type: filetype});
                        blob.name = filename;
                        deferred.resolve(blob);
                    }
                });
            }

            return deferred.promise;
        }


        /**
         * Uploads the file contained in the field specified by oldFieldname
         * as a Blob to the new node and saves the new node up to the server.
         *
         * @param rawNode
         * @param newVersion
         * @param oldFieldname
         * @param newFieldname
         * @returns {*}
         */
        function uploadFileFieldAndSave(rawNode, newVersion, oldFieldname, newFieldname) {
            var deferred = $q.defer();

            linfo("Uploading node: "+rawNode.nid+" title: "+rawNode.title+" (uploadFileFieldAndSave)");

            if (TEST_MODE || !rawNode[oldFieldname].und) {
                $log.warn("Node has no media file for " + newFieldname);
                newVersion.save()

                    .then(function () {
                        linfo("Saved new version!");
                        deferred.resolve(newVersion);

                    }, function (err) {
                        $log.error("Saving error: " + err);
                        deferred.reject("SAVE_ERR");
                    });
            }

            else {

                createBlob(rawNode, rawNode[oldFieldname].und[0].filename,
                    rawNode[oldFieldname].und[0].filemime)

                    .then(function (blob) {
                        newVersion[newFieldname].value = blob;

                        newVersion.save()

                            .then(function () {
                                $log.info("Saved new version!");
                                deferred.resolve(newVersion);

                            }, function (err) {
                                $log.error("Saving error: " + err);
                                deferred.reject("SAVE_ERR");
                            });
                    },

                    function (err) {
                        $log.warn("Could not create blob for attached file, returning.");
                        deferred.reject(err);
                    });
            }

            return deferred.promise;
        }


        /**
         * Uploads the file named filename from the snapshot directory for rawNode's
         * type as a Blob to newNode and saves the newNode up to the server.
         *
         * @param rawNode
         * @param newNode
         * @param filename
         * @param filemime
         * @param newFieldname
         * @returns {*}
         */
        function uploadFileAndSave(rawNode, newNode, filename, filemime, newFieldname) {
            var deferred = $q.defer();

            linfo("Uploading node: "+rawNode.nid+" filename: "+filename+" (uploadFileAndSave)");

            if (TEST_MODE) {
                $log.warn("Node has no media file for " + newFieldname);
                newNode.save()

                    .then(function () {
                        linfo("Saved new version!");
                        deferred.resolve(newNode);

                    }, function (err) {
                        $log.error("Saving error: " + err);
                        deferred.reject("SAVE_ERR");
                    });
            }

            else {
                try {
                    createBlob(rawNode, filename, filemime)

                        .then(function (blob) {
                                newNode[newFieldname].value = blob;

                                newNode.save()

                                    .then(function () {
                                        linfo("Saved new version!");
                                        deferred.resolve(newNode);

                                    }, function (err) {
                                        $log.error("Saving error: " + err);
                                        deferred.reject("SAVE_ERR");
                                    });
                            },

                            function (err) {
                                $log.warn("Could not create blob for attached file, returning.");
                                deferred.reject(err);
                            });

                } catch (err) {
                    $log.warn("Node has no media file for " + newFieldname);
                    newNode.save()

                        .then(function () {
                            linfo("Saved new version!");
                            deferred.resolve(newNode);

                        }, function (err) {
                            $log.error("Saving error: " + err);
                            deferred.reject("SAVE_ERR");
                        });
                }
            }

            return deferred.promise;
        }


        /**
         * Creates new pin_icon node from rawNode's thumbnail field and adds a reference to
         * it in the newVersion.
         *
         * @param rawNode
         * @param newVersion
         */
        function thumbnailToPin(rawNode, newVersion) {
            var deferred = $q.defer();

            // check if node has a thumbnail image
            if (rawNode.field_thumbnail && rawNode.field_thumbnail.und) {

                linfo("Converting thumb to pin: "+rawNode.nid+" title: "+rawNode.title+" (thumbnailToPin)");

                var pinNode = cmsModel.newPinIconAssetNode();

                // set title to filename if no title is found
                pinNode.title = rawNode.field_thumbnail.und[0].title;
                if (!pinNode.title) {
                    pinNode.title = rawNode.field_thumbnail.und[0].filename;
                }

                uploadFileFieldAndSave(rawNode, pinNode, "field_thumbnail", "field_pin_icon_image")

                    .then(function (newPinNode) {
                        cmsModel.parseFieldServices(newVersion.field_pin_icon_ref, newPinNode.nid, newPinNode.nid);
                        _pinDict[rawNode.field_thumbnail.und[0].fid] = newPinNode.nid;
                        deferred.resolve("Pin icon ref saved.");

                    }, function (err) {
                        deferred.reject(err);
                    });
            }

            else {
                deferred.resolve("No thumbnail.");
            }

            return deferred.promise;
        }


        /**
         * Uploads the rawNode's background image to a new Background Image Asset and
         * references this new node in newVersion.
         *
         * @param rawNode
         * @param newVersion
         * @param newField
         * @returns {*}
         */
        function getBackgroundImage(rawNode, newVersion, newField) {
            var deferred = $q.defer();

            // check if node has a background image
            if (rawNode.field_background_image && rawNode.field_background_image.und) {

                linfo("Converting background image.");
                var imgNode = cmsModel.newBackgroundImageAssetNode();

                // set title to filename if no title is found (which is basically always MAK)
                imgNode.title = rawNode.field_background_image.und[0].title;
                if (!imgNode.title) {
                    imgNode.title = rawNode.field_background_image.und[0].filename;
                }

                linfo("Created background image: "+imgNode.title);

                uploadFileFieldAndSave(rawNode, imgNode, "field_background_image", "field_background_image")

                    .then(function (newNode) {
                        cmsModel.parseFieldServices(newVersion[newField], newNode.nid, newNode.nid);
                        linfo("New background image posted with NID: "+newNode.nid);

                        deferred.resolve(newNode);

                    }, function (err) {
                        $log.error("MigrateService: Error creating background: "+err);
                        deferred.reject(err);
                    });
            }

            else {
                linfo("no background image");
                deferred.resolve("No background image.");
            }

            return deferred.promise;
        }


        /**
         * Uploads the rawNode's background image to a new Background Image Asset and
         * references this new node in newVersion.
         *
         * @param rawNode
         * @param newVersion
         * @returns {*}
         */
        function getImageAssetForQuote(rawNode, newVersion) {
            var deferred = $q.defer();

            // check if node has a background image
            if (rawNode.field_background_image && rawNode.field_background_image.und) {

                var imgNode = cmsModel.newImageAssetNode();

                // set title to filename if no title is found
                imgNode.title = rawNode.field_background_image.und[0].title;
                if (!imgNode.title) {
                    imgNode.title = rawNode.field_background_image.und[0].filename;
                }

                linfo("Created new local quote background image: "+imgNode.title);
                uploadFileFieldAndSave(rawNode, imgNode, "field_background_image", "field_image")

                    .then(function (newNode) {
                        cmsModel.parseFieldServices(newVersion.field_quote_background_image_ref,
                            newNode.nid, newNode.nid);
                        deferred.resolve(newNode);

                    }, function (err) {
                        linfo("Failed uploading background image for quote.");
                        deferred.reject(err);
                    });
            }

            else {
                linfo("No background image for quote.");
                deferred.resolve("No background image.");
            }

            return deferred.promise;
        }


        /**
         * Migrates the fields common to all drupal nodes and common to all Experience
         * Generator nodes from an old v1.1 node to a new v1.2 node.
         *
         * @param rawNode
         * @param newVersion
         */
        function migrateBaseNode(rawNode, newVersion) {

            // Fields common to all drupal nodes
            newVersion.title = rawNode.title;
            newVersion.status = rawNode.status;


            // Fields common to all Experience Generator nodes
            cmsModel.parseFieldServices(newVersion.field_notes, rawNode.field_notes, "");
            cmsModel.parseFieldServices(newVersion.field_content_author, rawNode.field_content_author, "");
            cmsModel.parseFieldServices(newVersion.field_content_owner, rawNode.field_content_owner, "");
            cmsModel.parseFieldServices(newVersion.field_content_agency, rawNode.field_content_agency, "");

            cmsModel.parseFieldServices(newVersion.field_key_points, rawNode.field_key_points, []);
            cmsModel.parseFieldServices(newVersion.field_geo_region, rawNode.field_geo_region, []);
            cmsModel.parseFieldServices(newVersion.field_geo_country, rawNode.field_geo_country, []);

            return thumbnailToPin(rawNode, newVersion);
        }


        /**
         * Migrates an image_with_caption node to an image_asset node and returns a promise.
         *
         * @param rawNode
         * @returns {*}
         */
        function imageWithCaption(rawNode) {
            var deferred = $q.defer();
            var newVersion = cmsModel.newImageAssetNode();

            linfo("Migrating image with caption NID=" + rawNode.nid);
            migrateBaseNode(rawNode, newVersion)

                .then(function() {
                    cmsModel.parseFieldServices(newVersion.field_description, rawNode.field_description, "");

                     uploadFileFieldAndSave(rawNode, newVersion, 'field_upload_image', 'field_image')

                        .then(function(newNode) {
                             _nidDict[rawNode.nid] = newNode.nid;
                             deferred.resolve();

                        }, function(err) {
                             deferred.reject(err);
                        })

                }, function(err) {
                    deferred.reject(err);
                });


            return deferred.promise;
        }


        /**
         * Migrates a video_component node to a video_asset node and returns a promise.
         *
         * @param rawNode
         * @returns {*}
         */
        function videoComponent(rawNode) {
            var deferred = $q.defer();
            var newVersion = cmsModel.newVideoAssetNode();

            linfo("Migrating video component NID=" + rawNode.nid);

            migrateBaseNode(rawNode, newVersion)

                .then(function() {
                    cmsModel.parseFieldServices(newVersion.field_description, rawNode.field_description, "");

                    newVersion.save()

                        .then(function () {
                            linfo("Saved new version!");
                            _nidDict[rawNode.nid] = newVersion.nid;
                            deferred.resolve();

                        }, function (err) {
                            $log.error("Saving error: " + err);
                            deferred.reject("SAVE_ERR");
                        });

                    /*uploadFileFieldAndSave(rawNode, newVersion, 'field_upload_video', 'field_video')

                        .then(function(newNode) {
                            _nidDict[rawNode.nid] = newNode.nid;
                            deferred.resolve();

                        }, function(err) {
                            deferred.reject(err);
                        })
                    */

                }, function(err) {
                    deferred.reject(err);
                });


            return deferred.promise;
        }


        /**
         * Migrates a quote_component node to a quote_asset node and returns a promise.
         *
         * @param rawNode
         * @returns {*}
         */
        function quoteComponent(rawNode) {
            var deferred = $q.defer();
            var newVersion = cmsModel.newQuoteAssetNode();

            linfo("Migrating quote component NID=" + rawNode.nid);

            migrateBaseNode(rawNode, newVersion)

                .then(function() {
                    cmsModel.parseFieldServices(newVersion.field_description, rawNode.field_description, "");
                    cmsModel.parseFieldServices(newVersion.field_quote_text, rawNode.field_quote_text, "");
                    cmsModel.parseFieldServices(newVersion.field_quote_author, rawNode.field_quote_author, "");
                    cmsModel.parseFieldServices(newVersion.field_quote_author_title, rawNode.field_quote_author_title, "");

                    getImageAssetForQuote(rawNode, newVersion)

                        .then(function() {

                            newVersion.save()
                                .then(function (data) {
                                    $log.info("Saved new version!");
                                    _nidDict[rawNode.nid] = newVersion.nid;
                                    deferred.resolve("Saved new version!");

                                }, function (err) {
                                    $log.error("Saving error: " + err);
                                    deferred.reject("SAVE_ERR");
                                });

                        }, function(err) {
                            deferred.reject(err);
                        })

                }, function(err) {
                    deferred.reject(err);
                });


            return deferred.promise;
        }


        /**
         * Migrates a live_demo_component node to a live_demo_asset node and returns a promise.
         *
         * @param rawNode
         * @returns {*}
         */
        function liveDemoComponent(rawNode) {
            var newVersion = cmsModel.newLiveDemoAssetNode();
            var deferred = $q.defer();

            linfo("Migrating live demo component NID=" + rawNode.nid);

            migrateBaseNode(rawNode, newVersion)

                .then(function() {

                    cmsModel.parseFieldServices(newVersion.field_description, rawNode.field_description, "");
                    cmsModel.parseFieldServices(newVersion.field_live_video_caption, rawNode.field_live_video_caption, "");
                    cmsModel.parseFieldServices(newVersion.field_demonstrator_name, rawNode.field_demonstrator_name, "");
                    cmsModel.parseFieldServices(newVersion.field_demonstrator_title, rawNode.field_demonstrator_title, "")

                    newVersion.save()
                        .then(function (data) {
                            $log.info("Saved new version!");
                            _nidDict[rawNode.nid] = newVersion.nid;
                            deferred.resolve("Saved new version!");

                        }, function (err) {
                            $log.error("Saving error: " + err);
                            deferred.reject("SAVE_ERR");
                        });

                }, function(err) {
                    deferred.reject(err);
                });


            return deferred.promise;
        }


        /**
         * Migrates a presentation_asset node to an extended_presentation_asset node and returns a promise.
         *
         * @param rawNode
         * @returns {*}
         */
        function presentationAsset(rawNode) {
            var deferred = $q.defer();
            var newVersion = cmsModel.newPresentationNode();
            var slideObj = {arr:[]};

            linfo("Migrating presentation asset NID=" + rawNode.nid);

            migrateBaseNode(rawNode, newVersion)

                .then(function() {

                    cmsModel.parseFieldServices(newVersion.field_description, rawNode.field_description, "");

                    createPresoSlides(rawNode, slideObj, 0)

                        .then(function() {
                            cmsModel.parseFieldServices(newVersion.field_preso_slides, slideObj.arr, slideObj.arr);

                            newVersion.save()
                                .then(function (data) {
                                    $log.info("Saved new version!");
                                    _nidDict[rawNode.nid] = newVersion.nid;
                                    deferred.resolve("Saved new version!");

                                }, function (err) {
                                    $log.error("Saving error: " + err);
                                    deferred.reject("SAVE_ERR");
                                });

                        }, function(err) {
                            deferred.reject(err);
                        });

                }, function(err) {
                    deferred.reject(err);
                });


            return deferred.promise;
        }


        function createPresoSlides(rawNode, slideObj, imgIdx) {
            var deferred = $q.defer();

            if (!rawNode.field_presentation_images.und || TEST_MODE) {
                deferred.resolve();
            }

            else if (imgIdx < rawNode.field_presentation_images.und.length) {
                var slideNode = cmsModel.newPresentationSlideNode();
                var img = rawNode.field_presentation_images.und[imgIdx];

                slideNode.title = rawNode.title + ": Slide " + img.filename;

                linfo("Creating presentation slide idx=" + imgIdx + " (createPresoSlides)");

                uploadFileAndSave(rawNode, slideNode, img.filename, img.filemime, "field_image")

                    .then(function (newNode) {
                        slideObj.arr.push(newNode.nid);
                        createPresoSlides(rawNode, slideObj, ++imgIdx)
                            .then(function() {
                                deferred.resolve();
                            }, function(err) {
                                deferred.reject(err);
                            })

                    }, function (err) {
                        $log.error("Error creating preso slides!!!");
                        deferred.reject(err);
                    });
            }

            else {
                deferred.resolve();
            }

            return deferred.promise;
        }


        /**
         * Migrates a v1.1 file_asset node to a v1.2 file_asset node and returns a promise.
         *
         * @param rawNode
         * @returns {*}
         */
        function fileAsset(rawNode) {
            var deferred = $q.defer();
            var newVersion = cmsModel.newFileAssetNode();

            linfo("Migrating file asset NID=" + rawNode.nid);

            migrateBaseNode(rawNode, newVersion)

                .then(function() {
                    cmsModel.parseFieldServices(newVersion.field_description, rawNode.field_description, "");

                    uploadFileFieldAndSave(rawNode, newVersion, 'field_file', 'field_file')

                        .then(function(newNode) {
                            _nidDict[rawNode.nid] = newNode.nid;
                            deferred.resolve();

                        }, function(err) {
                            deferred.reject(err);
                        })

                }, function(err) {
                    deferred.reject(err);
                });


            return deferred.promise;
        }


        /**
         * Migrates a v1.1 experience node to a v1.2 experience_container node and
         * returns a promise.
         *
         * @param rawNode
         * @returns {*}
         */
        function experience(rawNode) {
            var deferred = $q.defer();
            var newVersion = cmsModel.newExperienceContainerNode();
            var assets = {arr:[]};

            linfo("Migrating experience NID=" + rawNode.nid);

            migrateBaseNode(rawNode, newVersion)

                .then(function() {
                    cmsModel.parseFieldServices(newVersion.field_customer_name, rawNode.field_customer_name, "");
                    cmsModel.parseFieldServices(newVersion.field_exchange_text, rawNode.field_exchange_text, "");
                    cmsModel.parseFieldServices(newVersion.field_engage, rawNode.field_engage, "");
                    cmsModel.parseFieldServices(newVersion.field_experience_text, rawNode.field_experience_text, "");

                    cmsModel.parseFieldServices(newVersion.field_experience_date, rawNode.field_experience_date, new Date());

                    linfo("Getting background image...");

                    getBackgroundImage(rawNode, newVersion, "field_background_image_ref")

                        .then(function() {
                            linfo("Got background image! Now creating asset wrappers...");
                           createAssetWrappers(rawNode, "field_referenced_content", assets, 0)
                               .then(function() {
                                   linfo("Done creating asset wrappers!");
                                   cmsModel.parseFieldServices(newVersion.field_referenced_content, assets.arr, assets.arr);

                                   newVersion.save()
                                       .then(function (data) {
                                           $log.info("Saved new version!");
                                           _nidDict[rawNode.nid] = newVersion.nid;
                                           deferred.resolve("Saved new version!");

                                       }, function (err) {
                                           $log.error("Saving error: " + err);
                                           deferred.reject("SAVE_ERR");
                                       });

                               }, function(err) {
                                   deferred.reject(err);
                               });

                        }, function(err) {
                            deferred.reject(err);
                        })

                }, function(err) {
                    deferred.reject(err);
                });


            return deferred.promise;
        }


        function createAssetWrappers(node, fieldname, assets, idx) {
            var deferred = $q.defer();

            linfo("Creating asset wrapper from old node's (NID=" + node.nid + ") assets at index " + idx);

            if (!node[fieldname].und) {
                deferred.resolve();
            }

            else if (idx < node[fieldname].und.length) {
                var assetNode = cmsModel.newAssetWrapperNode();
                var oldNid = node[fieldname].und[idx].target_id;

                assetNode.title = "Node " + _nidDict[oldNid] + " in " + node.title;
                assetNode.field_wrapped_asset.value = _nidDict[oldNid];

                if (!assetNode.field_wrapped_asset.value) {
                    $log.warn("Referenced content at nid=" + oldNid + " does not exist. (createAssetWrappers)");
                    createAssetWrappers(node, fieldname, assets, ++idx)
                        .then(function () {
                            deferred.resolve();
                        }, function (err) {
                            deferred.reject(err);
                        })
                }

                else {
                    assetNode.save()
                        .then(function () {
                            $log.info("Saved new asset wrapper!");
                            assets.arr.push(assetNode.nid);
                            createAssetWrappers(node, fieldname, assets, ++idx)
                                .then(function () {
                                    deferred.resolve();
                                }, function (err) {
                                    deferred.reject(err);
                                })

                        }, function (err) {
                            $log.error("Saving error: " + err);
                            deferred.reject("SAVE_ERR");
                        });
                }
            }

            else {
                deferred.resolve();
            }

            return deferred.promise;
        }


        /**
         * Migrates a v1.1 Content Module to a v1.2 Content Module Container and returns a promise.
         *
         * @param rawNode
         * @returns {*}
         */
        function contentModule(rawNode) {
            var deferred = $q.defer();
            var newVersion = cmsModel.newContentModuleContainerNode();
            var assets = {arr:[]};
            var defaultAsset = {arr:[]};

            linfo("Migrating content module NID=" + rawNode.nid);

            migrateBaseNode(rawNode, newVersion)

                .then(function() {
                    cmsModel.parseFieldServices(newVersion.field_description, rawNode.field_description, "");

                    createAssetWrappers(rawNode, "field_referenced_media_component", assets, 0)
                        .then(function() {
                            cmsModel.parseFieldServices(newVersion.field_referenced_assets, assets.arr, assets.arr);

                            createAssetWrappers(rawNode, "field_default_component_view", defaultAsset, 0)
                                .then(function() {
                                    cmsModel.parseFieldServices(newVersion.field_default_asset, defaultAsset.arr[0], 0);

                                    newVersion.save()
                                        .then(function () {
                                            $log.info("Saved new version!");
                                            _nidDict[rawNode.nid] = newVersion.nid;
                                            deferred.resolve("Saved new version!");

                                        }, function (err) {
                                            $log.error("Saving error: " + err);
                                            deferred.reject("SAVE_ERR");
                                        });

                                }, function(err) {
                                    deferred.reject(err);
                                })


                        }, function(err) {
                            deferred.reject(err);
                        });

                }, function(err) {
                    deferred.reject(err);
                });


            return deferred.promise;
        }


        /**
         * Performs the migration of the rawNode to a v1.2 node and saves to the server.
         *
         * @param rawNode
         * @returns {*}
         */
        service.doMigration = function(rawNode) {

            switch (rawNode.type) {

                case "image_with_caption":
                    return imageWithCaption(rawNode);
                    break;

                case "video_component":
                    return videoComponent(rawNode);
                    break;

                case "quote_component":
                    return quoteComponent(rawNode);
                    break;

                case "live_demo_component":
                    return liveDemoComponent(rawNode);
                    break;

                case "presentation_asset":
                    return presentationAsset(rawNode);
                    break;

                case "file_asset":
                    return fileAsset(rawNode);
                    break;

                case "experience":
                    return experience(rawNode);
                    break;

                case "topic_template":
                    return contentModule(rawNode);
                    break;

                default:
                    var deferred = $q.defer();
                    deferred.reject("TYPE_ERR");
                    return deferred.promise;
            }
        };


        /**
         * Saves oldNid:newNid pairs to a json file. Returns a promise.
         *
         * @param filename
         */
        service.saveNidDict = function(filename) {

            return $q(function(resolve, reject) {

                fs.writeFile(filename, JSON.stringify(_nidDict), function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve("Saved nid pairs to " + filename);
                    }
                });
            });
        };


        /**
         * Saves fileId:pinNodeId pairs to a json file. Returns a promise.
         *
         * @param filename
         */
        service.savePinDict = function(filename) {

            return $q(function(resolve, reject) {

                jsonfile.writeFile(filename, _pinDict, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve("Saved pin_icon id pairs to " + filename);
                    }
                });
            });
        };


        /**
         * Saves nid and file/pin ref pairs to json files.
         *
         * @param nidFile
         * @param pinFile
         */
        service.saveDicts = function(nidFile, pinFile) {
            var sndp = service.saveNidDict(nidFile);
            var spdp = service.savePinDict(pinFile);

            return $q.all([sndp, spdp]);
        };


        return service;

    });