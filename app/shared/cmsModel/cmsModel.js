/**
 * Created by mkahn on 10/12/14.
 */

//This is the stock angular module pattern
(function (window, angular, undefined) {

    'use strict';

    angular.module('cmsModel.service', ['ngDrupal'])
        .factory('cmsModel', [
            'drupal', '$q', '$log', function (drupal, $q, $log) {

                var svc = {};

                //_isMock is defined in the mock version, undefined in the real version
                //This call is used in unit testing
                svc._mock = drupal._isMock;

                svc.cacheEnabled = false;
                var _memNodeCache = {};

                var FIELD_TEXT = "text";
                var FIELD_TEXT_ARRAY = "text_array";
                var FIELD_DATE = "date";
                var FIELD_RGB = "rgb";
                var FIELD_IMAGE_REF = "image_ref";
                var FIELD_FILE_REF = "file_ref";
                var FIELD_REF = "ref";
                var FIELD_REF_ARRAY = "ref_array";
                var FIELD_TAX = "tax";
                var FIELD_TAX_ARRAY = "tax_array";
                var FIELD_BOOL = "bool";
                var FIELD_RAW = "raw";


                function updateCache(node) {

                    if (svc.cacheEnabled && node.nid) {
                        _memNodeCache[node.nid] = node;
                    }
                }

                function getFromCache(nid) {
                    return _memNodeCache[nid];
                }

                function CMSModelException(message) {
                    this.message = message;
                    this.name = "CMSModelException";
                }

                /**
                 * Main entry point to throw a node field parse off to the right parser.
                 *
                 * @param targetField
                 * @param inboundJson
                 * @param defaultValue
                 * @param jsonStyle
                 */
                function parseField(targetField, inboundJson, defaultValue, jsonStyle) {

                    //First check if the inbound field is even there.
                    //If not, we may be building a summary node instead full
                    if (inboundJson === undefined) {
                        targetField.value = defaultValue;
                        return;
                    }


                    if (jsonStyle === undefined) {
                        jsonStyle = "Services"; // default is Drupal Services style nodes
                    }

                    switch (jsonStyle) {

                        case "Services":

                            parseFieldServices(targetField, inboundJson, defaultValue);
                            break;

                        case "JSONDoc":
                            parseFieldJSONDocument(targetField, inboundJson, defaultValue);
                            break;

                        default:
                            throw new CMSModelException("Bad jsonStyle in field parser: " + jsonStyle);

                    }

                }

                /**
                 * Handles classic Drupal Services style field types
                 * @param targetField
                 * @param inboundJson
                 * @param defaultValue
                 */
                function parseFieldServices(targetField, inboundJson, defaultValue) {

                    var fType = targetField.type;

                    switch (fType) {

                        case FIELD_TEXT:
                            try {
                                targetField.value = inboundJson.und[0].value || defaultValue;
                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_TEXT_ARRAY:
                            try {
                                var entries = inboundJson.und;
                                targetField.value = [];
                                entries.forEach(function (entry) {
                                    targetField.value.push(entry.value);
                                });
                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_TAX:
                            try {
                                var entriesFT = inboundJson.und;
                                targetField.value = parseInt(entriesFT[0].tid);
                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_TAX_ARRAY:
                            try {
                                var entriesFTA = inboundJson.und;
                                targetField.value = [];
                                entriesFTA.forEach(function (entry) {
                                    targetField.value.push(parseInt(entry.tid.toString()));
                                });
                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_REF:
                            try {
                                targetField.value = parseInt(inboundJson.und[0].target_id);
                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_REF_ARRAY:
                            try {
                                var entriesFRA = inboundJson.und;
                                targetField.value = [];
                                entriesFRA.forEach(function (entry) {
                                    targetField.value.push(parseInt(entry.target_id));
                                });
                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_RGB:
                            try {
                                targetField.value = inboundJson.und[0].rgb;
                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_DATE:
                            try {
                                targetField.value = new Date(inboundJson.und[0].value);
                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_BOOL:
                            try {
                                targetField.value = (inboundJson.und[0].value == 1);
                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_IMAGE_REF:
                        case FIELD_FILE_REF:
                            try {
                                targetField.value = {
                                    fid: parseInt(inboundJson.und[0].fid),
                                    uri: inboundJson.und[0].uri
                                };

                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_RAW:
                            try {
                                targetField.value = inboundJson || "";

                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;


                        default:
                            throw new CMSModelException("Bad field type in Services field parser: " + fType);

                    }

                }

                /**
                 * Exposes the function that handles classic Drupal Services style field types.
                 *
                 * @param targetField
                 * @param inboundJson
                 * @param defaultValue
                 */
                svc.parseFieldServices = function(targetField, inboundJson, defaultValue) {

                    parseFieldServices(targetField, inboundJson, defaultValue);

                };

                /**
                 * Handles  JSON Document Module style field types
                 *
                 * This module has some limitations with ARRAY types and therefore is not used for
                 * that kind of fields. It is only used to grab long summaries of many nodes
                 * like all Experience Containers.
                 *
                 * @param targetField
                 * @param inboundJson
                 * @param defaultValue
                 */
                function parseFieldJSONDocument(targetField, inboundJson, defaultValue) {

                    var fType = targetField.type;

                    switch (fType) {

                        case FIELD_TEXT:
                            try {
                                targetField.value = inboundJson || defaultValue;
                            } catch (err) {
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_TEXT_ARRAY:
                            throw new CMSModelException("TEXT ARRAY not supported by JSON Doc field parser!");
                            return;

                        case FIELD_TAX:
                            //TODO
                            try {
                                targetField.value = inboundJson;
                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_TAX_ARRAY:
                            //TODO
                            try {
                                var entriesFTA = inboundJson.und;
                                targetField.value = [];
                                entriesFTA.forEach(function (entry) {
                                    targetField.value.push(parseInt(entry.tid));
                                });
                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_REF:
                            //Comes in as a single numeric string: "523"
                            try {
                                targetField.value = parseInt(inboundJson);
                            } catch (err) {
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_REF_ARRAY:
                            //Comes in as a CSV string of refs like:
                            // field_refs : "523, 224, 329"
                            try {

                                var entriesFRA = inboundJson.split(',');
                                targetField.value = [];
                                entriesFRA.forEach(function (entry) {
                                    targetField.value.push(parseInt(entry));
                                });
                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_RGB:
                            //Comes just as we like it: "#ff0044"
                            try {
                                targetField.value = inboundJson;
                            } catch (err) {
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_DATE:
                            //Comes as a JS usable date string
                            try {
                                targetField.value = new Date(inboundJson);
                            } catch (err) {
                                targetField.value = defaultValue;
                            }
                            return;

                        case FIELD_BOOL:
                            try {
                                targetField.value = (inboundJson == 1);
                            } catch (err) {
                                targetField.value = defaultValue;
                            }
                            return;

                        //Images come in like { src:"url...", alt: "" }
                        case FIELD_IMAGE_REF:
                        case FIELD_FILE_REF:
                            try {
                                targetField.value = {
                                    uri: inboundJson.src
                                };

                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;


                        case FIELD_RAW:
                            try {
                                targetField.value = inboundJson || "";

                            } catch (err) {
                                // No value, Drupal gives you an array and the above will shit
                                targetField.value = defaultValue;
                            }
                            return;


                        default:
                            throw new CMSModelException("Bad field type in JSON Doc field parser: " + fType);

                    }

                }

                /**
                 * Encodes for a POST or PUT using Services
                 * @param inbound
                 * @return Object for upsream version of field
                 */
                function encodeForUpstreamServices(inbound) {

                    var fType = inbound.type;
                    var upField = {};

                    switch (fType) {

                        case FIELD_TEXT:

                            upField = {und: [{value: inbound.value}]};
                            break;

                        case FIELD_TEXT_ARRAY:

                            //TODO this is a hack because KP&N must always be 10 items long
                            //and it is the only TEXT_ARRAY right now.
                            var entries = inbound.value;
                            var undArr = [];

                            /*
                             entries.forEach(function (s) {
                             undArr.push({value: s});
                             });
                             */

                            for (var idx = 0; idx < 10; idx++) {
                                if (idx < entries.length) {
                                    undArr.push({value: entries[idx]});
                                } else {
                                    undArr.push({value: ""});
                                }
                            }

                            upField = {und: undArr};
                            break;


                        case FIELD_TAX:
                        case FIELD_REF:

                            if (inbound.value != 0) {
                                upField = {und: [inbound.value]};
                            } else {
                                upField = undefined;
                            }

                            break;

                        case FIELD_TAX_ARRAY:
                        case FIELD_REF_ARRAY:

                            var refArr = [];

                            if (inbound.value) {
                                inbound.value.forEach(function (r) {
                                    refArr.push(r);
                                });
                                upField = {und: refArr};
                            } else {
                                upField = undefined;
                            }

                            break;

                        case FIELD_RGB:

                            upField = {und: [{rgb: inbound.value}]};
                            break;

                        case FIELD_DATE:
                            //This one is the wonkiest
                            var month = inbound.value.getMonth() + 1; //JS dates 0-11
                            var day = inbound.value.getDate();
                            var year = inbound.value.getFullYear();
                            var time = inbound.value.getHours() + ":" + inbound.value.getMinutes();
                            var d = month + "/" + day + "/" + year + " - " + time;

                            upField = {und: [{value: {date: d}}]};

                            break;

                        case FIELD_BOOL:

                            upField = {und: [{value: inbound.value ? 1 : 0}]};
                            break;

                        case FIELD_IMAGE_REF:
                        case FIELD_FILE_REF:

                            //MK: This is a new node or new file on an existing one
                            if (inbound.value instanceof File) {
                                upField = undefined;
                            } else {
                                upField = {und: [inbound.value]};
                            }
                            break;

                        //RAW is used when download from JDOC summaries, not needed going up.
                        case FIELD_RAW:
                            upField = undefined;
                            break;

                        default:
                            throw new CMSModelException("Bad field type in Services field upstream encoder: " + fType);

                    }

                    return upField;

                }

                svc.newUpstreamObject = function (drupalNode, verb) {

                    // Grab tge core Drupal fields
                    var outNode = {
                        uid: drupalNode.uid,
                        status: drupalNode.status,
                        title: drupalNode.title,
                        type: drupalNode.type
                    }


                    for (var field in drupalNode) {
                        if (field.indexOf('field') < 0) {
                            //$log.info("cmsModel: Skipping field: " + field);
                        } else {
                            var upField = encodeForUpstreamServices(drupalNode[field]);
                            //MK: if upfield is undefined it is an image that we will attach later
                            if (upField) {
                                outNode[field] = upField;
                            }
                        }
                    }

                    if (verb != "POST") {
                        outNode['nid'] = drupalNode.nid;
                    }

                    return outNode;

                }


                /**********************************************************************
                 * 1.2+ NODE TYPES
                 *********************************************************************/

                var NODE_EXPERIENCE_CONTAINER = "experience_container";
                var NODE_ASSET_WRAPPER = "asset_wrapper";
                var NODE_CM_CONTAINER = "content_module_container";
                var NODE_IMAGE_ASSET = "image_asset";
                var NODE_FILE_ASSET = "file_asset";
                var NODE_LIVE_DEMO_ASSET = "live_demo_asset";
                var NODE_QUOTE_ASSET = "quote_asset";
                var NODE_PIN_ICON = "pin_icon";
                var NODE_VIDEO_ASSET = "video_asset";
                var NODE_BACKGROUND_IMAGE = "background_image";
                var NODE_GLASS_WALL_ASSET = "glass_wall_asset";
                var NODE_PRESO_ASSET = "extended_preso_asset";
                var NODE_PRESO_SLIDE = "preso_slide_asset";

                /**********************************************************************
                 * 1.2+ MACHINE NAME -> OBJECT MAPPER and CREATION METHODS
                 **********************************************************************/

                svc._nodeMapper = {};
                svc._nodeMapper[NODE_EXPERIENCE_CONTAINER] = ExperienceContainerNode;
                svc._nodeMapper[NODE_ASSET_WRAPPER] = AssetWrapperNode;
                svc._nodeMapper[NODE_CM_CONTAINER] = ContentModuleContainerNode;
                svc._nodeMapper[NODE_IMAGE_ASSET] = ImageAssetNode;
                svc._nodeMapper[NODE_FILE_ASSET] = FileAssetNode;
                svc._nodeMapper[NODE_LIVE_DEMO_ASSET] = LiveDemoAssetNode;
                svc._nodeMapper[NODE_QUOTE_ASSET] = QuoteAssetNode;
                svc._nodeMapper[NODE_VIDEO_ASSET] = VideoAssetNode;
                svc._nodeMapper[NODE_PIN_ICON] = PinIconAssetNode;
                svc._nodeMapper[NODE_BACKGROUND_IMAGE] = BackgroundImageAssetNode;
                svc._nodeMapper[NODE_GLASS_WALL_ASSET] = GlassWallImageAssetNode;
                svc._nodeMapper[NODE_PRESO_ASSET] = ExtendedPresentationAssetNode;
                svc._nodeMapper[NODE_PRESO_SLIDE] = PresentationSlideAssetNode;


                /**
                 * Returns constructor for a node type, or undefined
                 * @param type
                 * @returns {*}
                 */
                svc.constructorForNodeType = function (type) {
                    return svc._nodeMapper[type];
                }

                /**
                 * Extracts the type from an inbound node then returns a JS object from that
                 * JSON, if possible. Expects SERVICES format ONLY.
                 *
                 * @param inboundJson
                 * @returns {*}
                 */
                svc.newNodeFromInboundJson = function (inboundJson, jsonStyle) {

                    var constructor = svc.constructorForNodeType(inboundJson.type);
                    if (constructor !== undefined) {
                        var rval = new constructor();
                        rval.inboundParse(inboundJson, jsonStyle);
                        if (jsonStyle=='Services')
                            updateCache(rval);
                        return rval;
                    } else {
                        //return undefined;
                        throw new CMSModelException("Undefined content type: " + inboundJson.type);


                    }
                }

                /**
                 *  Wraps a node but DOES NOT SAVE
                 */

                function newWrappedAsset(referencedAssetNode, containerNode) {

                    var defer = $q.defer();

                    var assetWrapper = svc.newAssetWrapperNode();

                    //Usually a lite node is passed here because JSON Doc formatter is a POS,
                    //So we need to get the full node. No harm if we already have it other than a GET

                    svc.getNode(referencedAssetNode.nid).then(
                        function (fullNode) {
                            assetWrapper.title = fullNode.nid + " in context of " + containerNode.nid;
                            assetWrapper.field_wrapped_asset.value = fullNode.nid;

                            //transfer notes and key points, hopefully not by reference
                            assetWrapper.field_notes.value = fullNode.field_notes.value;
                            fullNode.field_key_points.value.forEach(function (kp) {
                                assetWrapper.field_key_points.value.push(kp);
                            });
                            defer.resolve(assetWrapper);
                        },
                        function (err) {
                            defer.reject(err);
                        }
                    );


                    return defer.promise;
                }

                /**
                 * Base class for all Nodes
                 * @param node
                 * @constructor
                 */
                function BaseDrupalNode() {

                    // Core fields of all Drupal nodes
                    this.nid = 0;
                    this.created = 0;
                    this.changed = 0;
                    this.uid = 0;
                    this.status = 0;
                    this.uuid = 0;
                    this.title = "";
                    this.type = "";


                    /**
                     * Defines the basic 1st level security for editing a node.
                     * Ultimately, the Drupal PHP code does not have to respect this and
                     * can enforce even stricter rules.
                     * @returns {boolean}
                     */
                    this.canEdit = function () {

                        var userInfo = drupal.getUserSync();

                        //Anon user can do nothing
                        if (!userInfo.loggedIn)
                            return false;

                        if (this.data.uid == undefined)
                            return true; //new node

                        if (this.data.uid == userInfo.user.uid) {
                            return true;
                        } else if (_.contains(userInfo.user.roles, 'administrator')) {
                            return true;
                        } else if (_.contains(userInfo.user.roles, 'supervisor')) {
                            return true;
                        } else if (_.contains(userInfo.user.roles, 'approver')) {
                            return true;
                        } else if (_.contains(userInfo.user.roles, 'editor')) {
                            return false;
                        }

                        return false; // failsafe

                    }

                    //For prototype chain testing
                    this.whoIs = function () {
                        return "BaseDrupalNode";
                    }

                    //Inbound parsing of JSON from Drupal
                    //It would have been nice to have classical "super" calls to do this cleanly,
                    //but this is so fucking ugly in JS, we'll just use different methods for each of
                    //levels of hierarchy.

                    /**
                     * inboundParseBase
                     * @param jsonInboundNode
                     * @param jsonStyle Defaults to Services module /node style
                     */
                    this.inboundParseBase = function (jsonInboundNode, jsonStyle) {

                        if (jsonStyle === undefined) {
                            jsonStyle = "Services";
                        }

                        switch (jsonStyle) {

                            case 'Services':
                                this.nid = parseInt(jsonInboundNode.nid) || 0;
                                this.created = parseInt(jsonInboundNode.created) || 0;
                                this.changed = parseInt(jsonInboundNode.changed) || 0;
                                this.uid = parseInt(jsonInboundNode.uid) || 0;
                                this.status = parseInt(jsonInboundNode.status) || 0;
                                this.uuid = jsonInboundNode.uuid || 0;
                                this.title = jsonInboundNode.title || "Bad Node Title!";
                                this.type = jsonInboundNode.type || "missing_node_type";

                                break;

                            case 'JSONDoc':
                                //This is usually a Read Only "lite node", so not parsing everything
                                this.nid = parseInt(jsonInboundNode.nid) || 0;
                                this.title = jsonInboundNode.title || "Bad Node Title!";
                                this.type = jsonInboundNode.type || "missing_node_type";


                                break;

                            default:

                                throw new CMSModelException("Unsupported inbound JSON parser in BaseDrupalNode")

                        }


                    }

                    //This synonym will get overwritten when needed by subclasses
                    this.inboundParse = this.inboundParseBase;

                    this.saveNode = function () {

                        var _this = this;

                        if (this.nid) {

                            $log.info("CMSModel: updating existing node " + this.nid);
                            var outNode = svc.newUpstreamObject(this, 'PUT');
                            return drupal.updateNode(outNode).then(
                                function (data) {
                                    return _this;
                                });


                        } else {

                            $log.info("CMSModel: creating new node " + this.nid);
                            var outNode = svc.newUpstreamObject(this, 'POST');
                            return drupal.postNode(outNode).then(
                                function (data) {
                                    _this.nid = parseInt(data.data.nid);
                                    updateCache(_this);
                                    return _this;
                                });

                        }

                    }

                    //This synonym will get overwritten when needed by subclasses
                    this.save = this.saveNode;

                    //TODO this needs a code review
                    this.saveNodeWithAttachedFileField = function (fieldName) {

                        //TODO defer anti-pattern needs replacement
                        var defer = $q.defer();

                        var _this = this;
                        this.saveNode().then(
                            function (newNode) {
                                console.log(_this.type + " base node saved.");
                                _this.nid = newNode.nid;
                                if (_this[fieldName].value instanceof File || _this[fieldName].value instanceof Blob) {
                                    console.log("Seems we have some attaching to do!");
                                    drupal.attachFile(_this[fieldName].value, _this, fieldName).then(
                                        function (data) {
                                            updateCache(_this);
                                            defer.resolve(_this);
                                        },
                                        function (err) {
                                            defer.reject(err)
                                        }
                                    )
                                } else {
                                    //no more work, a file must have been attached previously!
                                    updateCache(_this);
                                    defer.resolve(_this);
                                }

                            },
                            function (err) {
                                console.log("Shit hit the fan saving " + _this.type);
                                defer.reject(err);
                            });

                        return defer.promise;

                    }

                    this.delete = function () {

                        delete _memNodeCache[this.nid];
                        return drupal.deleteNode(this.nid);

                    }

                    this.validateNode = function () {

                        if (this.title) {
                            return {valid: true, message: ""};
                        } else {
                            return {valid: false, message: "Title is required."};
                        }

                    }

                    //Synonym
                    this.validate = this.validateNode;

                }

                //Extends BaseDrupalNode with fields common to all Experience Generator Nodes
                function BaseExgenNode() {
                    // Call to parent constructor
                    BaseDrupalNode.call(this);

                    //Common text fields
                    this.field_notes = {type: FIELD_TEXT, value: ""};
                    this.field_content_author = {type: FIELD_TEXT, value: ""};
                    this.field_content_owner = {type: FIELD_TEXT, value: ""};
                    this.field_content_agency = {type: FIELD_TEXT, value: ""};

                    this.field_key_points = {type: FIELD_TEXT_ARRAY, value: []};

                    //Taxonomy fields
                    this.field_geo_region = {type: FIELD_TAX_ARRAY, value: []};
                    this.field_geo_country = {type: FIELD_TAX_ARRAY, value: []};


                    //Entity Refs
                    this.field_pin_icon_ref = {type: FIELD_REF, value: 0};

                    //For prototype chain testing
                    this.whoIs = function () {
                        return "BaseExgenNode";
                    }

                    /**
                     * inboundParseBaseExgen
                     * @param jsonInboundNode
                     * @param jsonStyle Defaults to Services module /node style
                     */
                    this.inboundParseBaseExgen = function (jsonInboundNode, jsonStyle) {

                        if (jsonStyle === undefined || jsonStyle == "Services" || jsonStyle == 'JSONDoc') {

                            //Kick the base Drupal fields upstream
                            this.inboundParseBase(jsonInboundNode, jsonStyle);

                            //Parse the
                            parseField(this.field_notes, jsonInboundNode.field_notes, "", jsonStyle);

                            parseField(this.field_content_author, jsonInboundNode.field_content_author, "", jsonStyle);
                            parseField(this.field_content_owner, jsonInboundNode.field_content_owner, "", jsonStyle);
                            parseField(this.field_content_agency, jsonInboundNode.field_content_agency, "", jsonStyle);

                            parseField(this.field_key_points, jsonInboundNode.field_key_points, [], jsonStyle);

                            parseField(this.field_geo_country, jsonInboundNode.field_geo_country, [], jsonStyle);
                            parseField(this.field_geo_region, jsonInboundNode.field_geo_region, [], jsonStyle);

                            // Not used by all, but no harm if included
                            parseField(this.field_pin_icon_ref, jsonInboundNode.field_pin_icon_ref, 0, jsonStyle);


                        } else {

                            throw new CMSModelException("Unsupported inbound JSON parser in BaseExgenNode")

                        }

                    }

                    //This synonym will get overwritten when needed by subclasses
                    this.inboundParse = this.inboundParseBaseExgen;


                }

                BaseExgenNode.prototype = Object.create(BaseDrupalNode.prototype);
                BaseExgenNode.prototype.constructor = BaseExgenNode;

                /**
                 * AssetWrapperNode
                 * @constructor
                 */
                function AssetWrapperNode() {
                    // Call to parent construtor
                    BaseDrupalNode.call(this);

                    //Type
                    this.type = "asset_wrapper";

                    //Common text fields
                    this.field_notes = {type: FIELD_TEXT, value: ""};
                    this.field_key_points = {type: FIELD_TEXT_ARRAY, value: []};

                    //Entity Refs
                    this.field_wrapped_asset = {type: FIELD_REF, value: 0};

                    //Pin tax ref array
                    this.field_pinned_to = {type: FIELD_TAX_ARRAY, value: []}

                    this.inboundParse = function (jsonInboundNode, jsonStyle) {

                        //Kick the base Drupal fields upstream
                        this.inboundParseBase(jsonInboundNode, jsonStyle);
                        parseField(this.field_notes, jsonInboundNode.field_notes, "", jsonStyle);
                        parseField(this.field_key_points, jsonInboundNode.field_key_points, [], jsonStyle);
                        parseField(this.field_wrapped_asset, jsonInboundNode.field_wrapped_asset, 0, jsonStyle);
                        parseField(this.field_pinned_to, jsonInboundNode.field_pinned_to, [], jsonStyle);

                    }


                }

                AssetWrapperNode.prototype = Object.create(BaseDrupalNode.prototype);
                AssetWrapperNode.prototype.constructor = AssetWrapperNode;


                //New Experience Node that implements wrapped assets
                function ExperienceContainerNode() {

                    // Call to parent construtor
                    BaseExgenNode.call(this);

                    //Type
                    this.type = "experience_container";

                    //Text fields
                    this.field_exchange_text = {type: FIELD_TEXT, value: ""};
                    this.field_engage = {type: FIELD_TEXT, value: ""};
                    this.field_experience_text = {type: FIELD_TEXT, value: ""};
                    this.field_customer_name = {type: FIELD_TEXT, value: "", required: true};

                    //Color
                    this.field_customer_color = {type: FIELD_RGB, value: "#238866"};

                    //Entity Refs
                    this.field_referenced_content = {type: FIELD_REF_ARRAY, value: []};
                    this.field_pinned_to_prysm = {type: FIELD_REF_ARRAY, value: []};
                    this.field_pinned_to_demo_studio = {type: FIELD_REF_ARRAY, value: []};
                    this.field_background_image_ref = {type: FIELD_REF, value: 0};

                    //Date
                    this.field_experience_date = {type: FIELD_DATE, value: new Date()};

                    this.field_published = {type: FIELD_BOOL, value: false};
                    this.field_sticky_experience = {type: FIELD_BOOL, value: false};


                    this.inboundParse = function (jsonInboundNode, jsonStyle) {

                        //Kick the base Drupal fields upstream
                        this.inboundParseBase(jsonInboundNode, jsonStyle);

                        //Kick the common fields upstream
                        this.inboundParseBaseExgen(jsonInboundNode, jsonStyle);

                        parseField(this.field_exchange_text, jsonInboundNode.field_exchange_text, "", jsonStyle);
                        parseField(this.field_engage, jsonInboundNode.field_engage, "", jsonStyle);
                        parseField(this.field_experience_text, jsonInboundNode.field_experience_text, "", jsonStyle);
                        parseField(this.field_customer_name, jsonInboundNode.field_customer_name, "", jsonStyle);

                        parseField(this.field_customer_color, jsonInboundNode.field_customer_color, "238866", jsonStyle);

                        parseField(this.field_referenced_content, jsonInboundNode.field_referenced_content, [], jsonStyle);
                        parseField(this.field_pinned_to_prysm, jsonInboundNode.field_pinned_to_prysm, [], jsonStyle);
                        parseField(this.field_pinned_to_demo_studio, jsonInboundNode.field_pinned_to_demo_studio, [], jsonStyle);
                        parseField(this.field_background_image_ref, jsonInboundNode.field_background_image_ref, 0, jsonStyle);

                        parseField(this.field_experience_date, jsonInboundNode.field_experience_date, new Date(), jsonStyle);

                        parseField(this.field_sticky_experience, jsonInboundNode.field_sticky_experience, false, jsonStyle);
                        parseField(this.field_published, jsonInboundNode.field_published, false, jsonStyle);

                    }

                    /**
                     * Convenience methods
                     */

                    this.addReferencedContent = function (referencedNode) {

                        var defer = $q.defer();
                        var _this = this; // because this is about to be that

                        //TODO maybe the NWA method should just do the save?
                        newWrappedAsset(referencedNode, this).then(
                            function (wa) {
                                wa.save().then(
                                    function (data) {
                                        _this.field_referenced_content.value.push(data.nid);
                                        defer.resolve(data.nid);

                                    }, function (err) {
                                        var aderr = new ADErrorObject();
                                        aderr.setCode(err.status)
                                            .setErrObject(err);
                                        defer.reject(aderr);
                                    });

                            },
                            function (err) {
                                var aderr = new ADErrorObject();
                                aderr.setCode(err.status)
                                    .setErrObject(err);
                                defer.reject(aderr);
                            }
                        );


                        return defer.promise;

                    }

                    this.removeReferencedContent = function (referencedNodeId) {

                        _.remove(this.field_referenced_content.value, function (nid) { return nid == referencedNodeId });
                        // Whack the wrapped asset, and we don't care about the pass/fail
                        drupal.deleteNode(referencedNodeId);

                    }
                }

                ExperienceContainerNode.prototype = Object.create(BaseExgenNode.prototype);
                ExperienceContainerNode.prototype.constructor = ExperienceContainerNode;

                /**
                 * ContentModuleContainerNode
                 *
                 * @constructor
                 */
                //Content Module Node
                function ContentModuleContainerNode() {

                    // Call to parent construtor
                    BaseExgenNode.call(this);

                    //Type
                    this.type = "content_module_container";

                    //Entity Refs
                    this.field_referenced_assets = {type: FIELD_REF_ARRAY, value: []};
                    this.field_default_asset = {type: FIELD_REF, value: 0};
                    this.field_type = {type: FIELD_TAX, value: 0};
                    this.field_description = {type: FIELD_TEXT, value: "", required: true};

                    this.inboundParse = function (jsonInboundNode, jsonStyle) {

                        //Kick the base Drupal fields upstream
                        this.inboundParseBase(jsonInboundNode, jsonStyle);

                        //Kick the common fields upstream
                        this.inboundParseBaseExgen(jsonInboundNode, jsonStyle);

                        parseField(this.field_referenced_assets, jsonInboundNode.field_referenced_assets, [], jsonStyle);
                        parseField(this.field_default_asset, jsonInboundNode.field_default_asset, 0, jsonStyle);
                        parseField(this.field_type, jsonInboundNode.field_type, 0, jsonStyle);
                        parseField(this.field_description, jsonInboundNode.field_description, "", jsonStyle);

                    }

                    /**
                     * Convenience methods
                     */

                        //TODO: These methods is duplicated from Experience. Should be in one place

                    this.addReferencedContent = function (referencedNode) {

                        var defer = $q.defer();
                        var _this = this; // because this is about to be that

                        //TODO maybe the NWA method should just do the save?
                        newWrappedAsset(referencedNode, this).then(
                            function (wa) {
                                wa.save().then(
                                    function (data) {
                                        _this.field_referenced_assets.value.push(data.nid);
                                        defer.resolve(data.nid);

                                    }, function (err) {
                                        var aderr = new ADErrorObject();
                                        aderr.setCode(err.status)
                                            .setErrObject(err);
                                        defer.reject(aderr);
                                    });

                            },
                            function (err) {
                                var aderr = new ADErrorObject();
                                aderr.setCode(err.status)
                                    .setErrObject(err);
                                defer.reject(aderr);
                            }
                        );


                        return defer.promise;

                    }

                    this.removeReferencedContent = function (referencedNodeId) {

                        _.remove(this.field_referenced_assets.value, function (nid) { return nid == referencedNodeId });
                        // Whack the wrapped asset, and we don't care about the pass/fail
                        drupal.deleteNode(referencedNodeId);

                    }

                }

                ContentModuleContainerNode.prototype = Object.create(BaseExgenNode.prototype);
                ContentModuleContainerNode.prototype.constructor = ContentModuleContainerNode;


                /**
                 * PinIconAsset
                 *
                 * @constructor
                 */
                //Pin Icon Node
                function PinIconAssetNode() {

                    // Pin Icon does not inherit all the common asset fields, so BaseDrupal is the parent
                    BaseDrupalNode.call(this);

                    //Type
                    this.type = "pin_icon";

                    this.field_content_creator = {type: FIELD_TEXT, value: ""};
                    this.field_content_owner = {type: FIELD_TEXT, value: ""};
                    this.field_content_agency = {type: FIELD_TEXT, value: ""};

                    this.field_published = {type: FIELD_BOOL, value: false};
                    this.field_description = {type: FIELD_TEXT, value: "", required: true};
                    this.field_pin_icon_image = {type: FIELD_IMAGE_REF, value: {}, required: true}

                    this.inboundParse = function (jsonInboundNode, jsonStyle) {

                        //Kick the base Drupal fields upstream
                        this.inboundParseBase(jsonInboundNode, jsonStyle);

                        parseField(this.field_content_creator, jsonInboundNode.field_content_creator, "", jsonStyle);
                        parseField(this.field_content_owner, jsonInboundNode.field_content_owner, "", jsonStyle);
                        parseField(this.field_content_agency, jsonInboundNode.field_content_agency, "", jsonStyle);
                        parseField(this.field_published, jsonInboundNode.field_published, false, jsonStyle);
                        parseField(this.field_description, jsonInboundNode.field_description, "", jsonStyle);
                        parseField(this.field_pin_icon_image, jsonInboundNode.field_pin_icon_image, {}, jsonStyle);
                    }

                    //MK: Overwritten for image attach
                    this.save = function () {

                        return this.saveNodeWithAttachedFileField('field_pin_icon_image');

                    }

                }

                PinIconAssetNode.prototype = Object.create(BaseDrupalNode.prototype);
                PinIconAssetNode.prototype.constructor = PinIconAssetNode;

                /**
                 * BackgroundImageAsset
                 *
                 * @constructor
                 */
                function BackgroundImageAssetNode() {

                    // Background Image does not inherit all the common asset fields, so BaseDrupal is the parent
                    BaseDrupalNode.call(this);

                    //Type
                    this.type = "background_image";

                    this.field_content_author = {type: FIELD_TEXT, value: ""};
                    this.field_content_owner = {type: FIELD_TEXT, value: ""};
                    this.field_content_agency = {type: FIELD_TEXT, value: ""};

                    this.field_published = {type: FIELD_BOOL, value: true};
                    this.field_description = {type: FIELD_TEXT, value: "", required: true};
                    this.field_background_image = {type: FIELD_IMAGE_REF, value: {}, required: true}

                    this.inboundParse = function (jsonInboundNode, jsonStyle) {

                        //Kick the base Drupal fields upstream
                        this.inboundParseBase(jsonInboundNode, jsonStyle);

                        parseField(this.field_content_author, jsonInboundNode.field_content_author, "", jsonStyle);
                        parseField(this.field_content_owner, jsonInboundNode.field_content_owner, "", jsonStyle);
                        parseField(this.field_content_agency, jsonInboundNode.field_content_agency, "", jsonStyle);
                        parseField(this.field_published, jsonInboundNode.field_published, false, jsonStyle);
                        parseField(this.field_description, jsonInboundNode.field_description, "", jsonStyle);
                        parseField(this.field_background_image, jsonInboundNode.field_background_image, {}, jsonStyle);
                    }

                    //MK: Overwritten for image attach
                    this.save = function () {

                        return this.saveNodeWithAttachedFileField('field_background_image');

                    }

                }

                BackgroundImageAssetNode.prototype = Object.create(BaseDrupalNode.prototype);
                BackgroundImageAssetNode.prototype.constructor = BackgroundImageAssetNode;

                //TODO copy over content authoring and published fields from BIAN
                /**
                 * GlassWallImageAssetNode
                 *
                 *
                 * @constructor
                 */
                //Content Module Node
                function GlassWallImageAssetNode() {

                    // Call to parent constructor. Some of the BaseExgen fields are not going to be used
                    // for this content type, but if they change their minds, they are there.
                    BaseExgenNode.call(this);

                    //Type
                    this.type = "glass_wall_image";

                    //Entity Refs
                    this.field_image = {type: FIELD_IMAGE_REF, value: {}};
                    this.field_description = {type: FIELD_TEXT, value: "", required: true};


                    this.inboundParse = function (jsonInboundNode, jsonStyle) {

                        //Kick the base Drupal fields upstream
                        this.inboundParseBase(jsonInboundNode, jsonStyle);

                        //Kick the common fields upstream
                        this.inboundParseBaseExgen(jsonInboundNode, jsonStyle);

                        parseField(this.field_image, jsonInboundNode.field_image, 0, jsonStyle);
                        parseField(this.field_description, jsonInboundNode.field_description, "", jsonStyle);

                    }

                }

                GlassWallImageAssetNode.prototype = Object.create(BaseExgenNode.prototype);
                GlassWallImageAssetNode.prototype.constructor = GlassWallImageAssetNode;


                /**
                 * ImageAssetNode
                 * Generic images, not backgrounds or pin icons
                 *
                 * @constructor
                 */
                //Content Module Node
                function ImageAssetNode() {

                    // Call to parent constructor
                    BaseExgenNode.call(this);

                    //Type
                    this.type = "image_asset";

                    //Entity Refs
                    this.field_image = {type: FIELD_IMAGE_REF, value: {}};
                    this.field_description = {type: FIELD_TEXT, value: "", required: true};


                    this.inboundParse = function (jsonInboundNode, jsonStyle) {

                        //Kick the base Drupal fields upstream
                        this.inboundParseBase(jsonInboundNode, jsonStyle);

                        //Kick the common fields upstream
                        this.inboundParseBaseExgen(jsonInboundNode, jsonStyle);

                        parseField(this.field_image, jsonInboundNode.field_image, 0, jsonStyle);
                        parseField(this.field_description, jsonInboundNode.field_description, "", jsonStyle);

                    }

                    //MK: Overwritten for image attach
                    this.save = function () {

                        return this.saveNodeWithAttachedFileField('field_image');

                    }

                }

                ImageAssetNode.prototype = Object.create(BaseExgenNode.prototype);
                ImageAssetNode.prototype.constructor = ImageAssetNode;

                /**
                 * VideoAssetNode
                 *
                 *
                 * @constructor
                 */
                //Content Module Node
                function VideoAssetNode() {

                    // Call to parent constructor
                    BaseExgenNode.call(this);

                    //Type
                    this.type = "video_asset";

                    //Entity Refs
                    this.field_video = {type: FIELD_FILE_REF, value: {}};
                    this.field_description = {type: FIELD_TEXT, value: "", required: true};
                    this.field_video_thumbnail = {type: FIELD_IMAGE_REF, value: {}};

                    //Field that only shows up in JSON Docs
                    this.field_video_url = {type: FIELD_RAW, value: ""};

                    this.inboundParse = function (jsonInboundNode, jsonStyle) {

                        //Kick the base Drupal fields upstream
                        this.inboundParseBase(jsonInboundNode, jsonStyle);

                        //Kick the common fields upstream
                        this.inboundParseBaseExgen(jsonInboundNode, jsonStyle);

                        parseField(this.field_video, jsonInboundNode.field_video, {}, jsonStyle);
                        parseField(this.field_description, jsonInboundNode.field_description, "", jsonStyle);
                        parseField(this.field_video_thumbnail, jsonInboundNode.field_video_thumbnail, {}, jsonStyle);

                        parseField(this.field_video_url, jsonInboundNode.field_video_url, "", jsonStyle);
                    }

                    //MK: Overwritten for video attach
                    //TODO this code is undoubtedly a huge pile of feces
                    this.save = function () {

                        var _node = this;

                        return $q(function (resolve, reject) {

                            _node.saveNodeWithAttachedFileField('field_video')
                                .then(function () {
                                          _node.saveNodeWithAttachedFileField('field_video_thumbnail').then(resolve);
                                      })
                                .catch(reject);


                        });

                    }


                }

                VideoAssetNode.prototype = Object.create(BaseExgenNode.prototype);
                VideoAssetNode.prototype.constructor = VideoAssetNode;

                /**
                 * FileAssetNode
                 *
                 *
                 * @constructor
                 */
                //Content Module Node
                function FileAssetNode() {

                    // Call to parent constructor
                    BaseExgenNode.call(this);

                    //Type
                    this.type = "file_asset";

                    //Entity Refs
                    this.field_file = {type: FIELD_FILE_REF, value: {}};
                    this.field_description = {type: FIELD_TEXT, value: "", required: true};

                    //Field that only shows up in JSON Docs, thank you fucktastic Services module.
                    this.field_file_url = {type: FIELD_RAW, value: ""};

                    this.inboundParse = function (jsonInboundNode, jsonStyle) {

                        //Kick the base Drupal fields upstream
                        this.inboundParseBase(jsonInboundNode, jsonStyle);

                        //Kick the common fields upstream
                        this.inboundParseBaseExgen(jsonInboundNode, jsonStyle);

                        parseField(this.field_file, jsonInboundNode.field_file, {}, jsonStyle);
                        parseField(this.field_description, jsonInboundNode.field_description, "", jsonStyle);
                        parseField(this.field_file_url, jsonInboundNode.field_file_url, "", jsonStyle);

                    }

                    //MK: Overwritten for file attach
                    this.save = function () {

                        return this.saveNodeWithAttachedFileField('field_file');

                    }

                }

                FileAssetNode.prototype = Object.create(BaseExgenNode.prototype);
                FileAssetNode.prototype.constructor = FileAssetNode;

                /**
                 * LiveDemoAssetNode
                 *
                 *
                 * @constructor
                 */
                //Content Module Node
                function LiveDemoAssetNode() {

                    // Call to parent constructor
                    BaseExgenNode.call(this);

                    //Type
                    this.type = "live_demo_asset";

                    this.field_description = {type: FIELD_TEXT, value: "", required: true};
                    this.field_demonstrator_name = {type: FIELD_TEXT, value: "", required: true};
                    this.field_demonstrator_title = {type: FIELD_TEXT, value: ""};
                    this.field_live_video_caption = {type: FIELD_TEXT, value: ""};


                    this.inboundParse = function (jsonInboundNode, jsonStyle) {

                        //Kick the base Drupal fields upstream
                        this.inboundParseBase(jsonInboundNode, jsonStyle);

                        //Kick the common fields upstream
                        this.inboundParseBaseExgen(jsonInboundNode, jsonStyle);

                        parseField(this.field_description, jsonInboundNode.field_description, "", jsonStyle);
                        parseField(this.field_demonstrator_name, jsonInboundNode.field_demonstrator_name, "", jsonStyle);
                        parseField(this.field_demonstrator_title, jsonInboundNode.field_demonstrator_title, "", jsonStyle);
                        parseField(this.field_live_video_caption, jsonInboundNode.field_live_video_caption, "", jsonStyle);

                    }

                }

                LiveDemoAssetNode.prototype = Object.create(BaseExgenNode.prototype);
                LiveDemoAssetNode.prototype.constructor = LiveDemoAssetNode;

                /**
                 * QuoteAssetNode
                 *
                 *
                 * @constructor
                 */
                //Content Module Node
                function QuoteAssetNode() {

                    // Call to parent constructor
                    BaseExgenNode.call(this);

                    //Type
                    this.type = "quote_asset";

                    this.field_description = {type: FIELD_TEXT, value: "", required: true};
                    this.field_quote_text = {type: FIELD_TEXT, value: "", required: true};
                    this.field_quote_author = {type: FIELD_TEXT, value: ""};
                    this.field_quote_author_title = {type: FIELD_TEXT, value: ""};

                    this.field_quote_background_image_ref = {type: FIELD_REF, value: 0};


                    this.inboundParse = function (jsonInboundNode, jsonStyle) {

                        //Kick the base Drupal fields upstream
                        this.inboundParseBase(jsonInboundNode, jsonStyle);

                        //Kick the common fields upstream
                        this.inboundParseBaseExgen(jsonInboundNode, jsonStyle);

                        parseField(this.field_description, jsonInboundNode.field_description, "", jsonStyle);
                        parseField(this.field_quote_text, jsonInboundNode.field_quote_text, "", jsonStyle);
                        parseField(this.field_quote_author, jsonInboundNode.field_quote_author, "", jsonStyle);
                        parseField(this.field_quote_author_title, jsonInboundNode.field_quote_author_title, "", jsonStyle);

                        parseField(this.field_quote_background_image_ref, jsonInboundNode.field_quote_background_image_ref, 0, jsonStyle);


                    }

                }

                QuoteAssetNode.prototype = Object.create(BaseExgenNode.prototype);
                QuoteAssetNode.prototype.constructor = QuoteAssetNode;

                /**
                 * ExtendedPresentationAsset
                 *
                 * Enhanced version that allows for reordering, notes per slide, etc.
                 *
                 *
                 * @constructor
                 */
                //Content Module Node
                function ExtendedPresentationAssetNode() {

                    // Call to parent constructor
                    BaseExgenNode.call(this);

                    //Type
                    this.type = "extended_preso_asset";

                    this.field_description = {type: FIELD_TEXT, value: "", required: true};
                    this.field_preso_slides = {type: FIELD_REF_ARRAY, value: []};

                    this.inboundParse = function (jsonInboundNode, jsonStyle) {

                        //Kick the base Drupal fields upstream
                        this.inboundParseBase(jsonInboundNode, jsonStyle);

                        //Kick the common fields upstream
                        this.inboundParseBaseExgen(jsonInboundNode, jsonStyle);

                        parseField(this.field_description, jsonInboundNode.field_description, "", jsonStyle);
                        parseField(this.field_preso_slides, jsonInboundNode.field_preso_slides, [], jsonStyle);

                    }

                }

                ExtendedPresentationAssetNode.prototype = Object.create(BaseExgenNode.prototype);
                ExtendedPresentationAssetNode.prototype.constructor = ExtendedPresentationAssetNode;

                /**
                 * PresentationSlideAssetNode
                 *
                 *
                 * @constructor
                 */
                //Content Module Node
                function PresentationSlideAssetNode() {

                    // Call to parent constructor
                    BaseExgenNode.call(this);

                    //Type
                    this.type = "preso_slide_asset";

                    //Entity Refs
                    this.field_image = {type: FIELD_IMAGE_REF, value: {}};
                    //this.field_description = {type: FIELD_TEXT, value: ""};


                    this.inboundParse = function (jsonInboundNode, jsonStyle) {

                        //Kick the base Drupal fields upstream
                        this.inboundParseBase(jsonInboundNode, jsonStyle);

                        //Kick the common fields upstream
                        this.inboundParseBaseExgen(jsonInboundNode, jsonStyle);

                        parseField(this.field_image, jsonInboundNode.field_image, 0, jsonStyle);
                        //parseField(this.field_description, jsonInboundNode.field_description, "");

                    }

                    //MK: Overwritten for image attach
                    this.save = function () {

                        return this.saveNodeWithAttachedFileField('field_image');

                    }

                }

                PresentationSlideAssetNode.prototype = Object.create(BaseExgenNode.prototype);
                PresentationSlideAssetNode.prototype.constructor = PresentationSlideAssetNode;

                /**
                 *
                 * BARE ASSET FACTORY METHODS
                 *
                 */

                svc.newBaseExgenNode = function () {
                    return new BaseExgenNode();
                }

                svc.newAssetWrapperNode = function () {
                    return new AssetWrapperNode();
                }

                svc.newExperienceContainerNode = function () {
                    return new ExperienceContainerNode();
                }

                svc.newContentModuleContainerNode = function () {
                    return new ContentModuleContainerNode();
                }

                svc.newPinIconAssetNode = function () {
                    return new PinIconAssetNode();
                }

                svc.newBackgroundImageAssetNode = function () {
                    return new BackgroundImageAssetNode();
                }

                svc.newImageAssetNode = function () {
                    return new ImageAssetNode();
                }

                svc.newPresentationNode = function () {
                    return new ExtendedPresentationAssetNode();
                }

                svc.newPresentationSlideNode = function () {
                    return new PresentationSlideAssetNode();
                }

                svc.newGlassWallAssetNode = function () {
                    return new GlassWallImageAssetNode();
                }

                svc.newVideoAssetNode = function () {
                    return new VideoAssetNode();
                }

                svc.newLiveDemoAssetNode = function () {
                    return new LiveDemoAssetNode();
                }

                svc.newQuoteAssetNode = function () {
                    return new QuoteAssetNode();
                }

                svc.newFileAssetNode = function () {
                    return new FileAssetNode();
                }

                /****************************************************************
                 * NODE FETCHERS
                 *
                 */

                svc.getNodesOfTypes = function (machineNames) {

                    var rval = [];
                    var d = $q.defer();
                    var mnameCount = machineNames.length;

                    function typeDone(type) {

                        mnameCount--;
                        console.log("Finished " + type + " count at: " + mnameCount);

                        if (mnameCount == 0) {
                            d.resolve(rval);
                        }

                    }

                    console.log("Getting nodes: " + machineNames);

                    machineNames.forEach(function (mName) {

                        console.log("Fetching " + mName);
                        drupal.fetchFullNodes(mName).then(
                            function (data) {
                                console.log("Got data for " + mName);
                                data.forEach(function (n) {
                                    var newNode = svc.newNodeFromInboundJson(n);
                                    rval.push(newNode)
                                });
                                typeDone(mName);
                            },
                            function () {
                                console.log('Error fetching nodes in getNodesOfTypes');
                                d.reject('Error fetching nodes in getNodesOfTypes');
                            });

                    })

                    return d.promise;


                }

                svc.getNodeSummariesOfType = function (type) {
                    var rval = [];
                    var d = $q.defer();

                    console.log("Fetching JDOC Summary for: " + type);
                    drupal.fetchJSONDocNodeSummary(type).then(
                        function (data) {
                            console.log("Got data for " + type);
                            data.forEach(function (n) {
                                var newNode = svc.newNodeFromInboundJson(n, 'JSONDoc');
                                rval.push(newNode)
                            });
                            d.resolve(rval);
                        },
                        function (errObj) {
                            console.log("CMSModel getNodeSummariesOfType error: " + errObj.message);
                            d.reject(errObj);
                        });

                    return d.promise;

                }

                //TODO older calls to this pass a type for checking, not used here. Should see if needed.
                svc.getNode = function (nid) {


                    if (svc.cacheEnabled && _memNodeCache[parseInt(nid)] !== undefined) {
                        $log.info('cmsModel: returning memcached version of node: ' + nid);
                        return $q.when(_memNodeCache[parseInt(nid)]);
                    }
                    else {

                        return drupal.fetchNode(nid).then(
                            function (nodeJson) {
                                return svc.newNodeFromInboundJson(nodeJson.data);
                            });

                    }


                }

                svc.taxonomyTree = {};

                svc.taxonomyDict = function () {

                    var ctdict = localStorage.getItem('taxonomyDict');
                    if (ctdict) {
                        return angular.fromJson(ctdict);
                    } else {
                        var rval = {};
                        _.forEach(svc.taxonomyTree, function (a, v) {
                            a.forEach(function (t) {
                                rval[t.tid] = t.name;
                            })
                        })

                        localStorage.setItem('taxonomyDict', angular.toJson(rval));
                        return rval;
                    }

                };

                svc.getTaxonomyTree = function (getRemote) {


                    if (getRemote) {
                        $log.info("cmsModel: getting taxonomies from cms directly");
                        return drupal.loadTaxonomies().then(
                            function (data) {
                                localStorage.setItem('taxonomyTree', angular.toJson(data));
                                svc.taxonomyTree = data;
                                svc.taxonomyDict(); // cache it
                                return data;
                            },
                            function (err) {
                                throw err;
                            });
                    }
                    else {
                        $log.info("cmsModel: getting taxonomies from cache");
                        return $q(function (resolve, reject) {
                            var localTT = localStorage.getItem('taxonomyTree');
                            if (localTT) {
                                svc.taxonomyTree = angular.fromJson(localTT);
                                resolve(svc.taxonomyTree);
                            } else {
                                //nothing cached, this is a CF
                                $log.error("CMSModel: trying to fetch uncached taxonomy data is a bad idea");
                                reject(new Error("No cached taxonomy data in cmsModel"));
                            }
                        });
                    }
                }

                svc.getTaxonomyVocabulary = function (machineName) {

                    var defer = $q.defer();

                    svc.getTaxonomyTree(true).then(
                        function (tree) {
                            defer.resolve(tree[machineName]);
                        },
                        function (err) {
                            defer.reject(err);
                        }
                    )

                    return defer.promise;

                };

                svc.mapHumanToTid = function (humanTerm) {

                    var td = svc.taxonomyDict();
                    for (var key in td) {
                        if (td.hasOwnProperty(key)) {
                            if (td[key] == humanTerm)
                                return parseInt(key);
                        }
                    }

                    return undefined;

                };

                svc.mapTidToHuman = function (tid) {
                    return svc.taxonomyDict()[tid];
                };


                svc._unitFlag = "Hello Jasmine!";

                svc.initialize = function () {

                    $log.info("cmsModel: initialize");
                    //svc.getTaxonomyTree(true);


                    drupal.getUserStatus()
                        .then(function (userInfo) {

                                  $log.info("cmsModel: User status fetched OK");

                                  if (drupal.isLoggedIn()) {

                                      drupal.kickInactivityTimer();
                                      //The 'true' forces a network load, which we want on init
                                      svc.getTaxonomyTree(true).then(
                                          function (data) {
                                              $log.info("cmsModel: Successful model init");

                                          },
                                          function (err) {
                                              $log.error("cmsModel: Error in model init");
                                          }
                                      );

                                  } else {

                                      $log.error("cmsModel: Anonymous user, shutting down hard!");

                                  }

                              })
                        .catch(function (err) {
                                   console.log("cmsModel: Bad user status");
                                   console.log(err);

                               });


                }

                return svc;

            }

        ])

    /**
     * Used by drag and drop directives to communicate with each other
     */
        .factory('arrayReorder', [
            '$log', function ($log) {

                var _theArray = [];
                var svc = {};

                svc.setArray = function (arr) {

                    _theArray = arr;
                }

                svc.getArray = function () {

                    return _theArray;
                }

                svc.moveInFrontOf = function (moving, target) {
                    $log.info("Moving in front of");
                    _theArray = [];

                }

                svc.moveInBackOf = function (moving, target) {
                    $log.info("Moving behind of");

                }

                svc.deleteAtIndex = function (index) {
                    $log.info("Deleting at: " + index);

                }

                svc.deleteEqualTo = function (item) {
                    $log.info("Deleting item: " + index);

                }

                return svc;

            }])


    /**
     * Pulls an image from a Node referenced by this node. For example, a Background Image Node referenced by
     * an Experience. Handles graceful failover of thumbnail to main image.
     *
     * For version 1.2
     * Accepts node Id for the referenced image and the field the image is on in the referenced node
     */
        .directive('cmsImageRef', [
            'drupal', 'cmsModel', function (drupal, cmsModel) {
                return {
                    restrict: 'A',
                    scope: {
                        refNodeField: '=',
                        imgField: '='
                    },
                    link: function (scope, element, attrs) {

                        var mainUrl;
                        var size = attrs.size;

                        setPlaceholderSrc();


                        function setPlaceholderSrc() {
                            attrs.$set('src', 'assets/img/icons/hex-loader2.gif');
                        }

                        function setErrSrc() {
                            attrs.$set('src', 'assets/img/test/missing_bg.png');
                        }

                        function getSrc() {

                            if (scope.refNodeField.value !== 0) {
                                drupal.fetchNode(scope.refNodeField.value).then(
                                    function (data) {
                                        var rnode = cmsModel.newNodeFromInboundJson(data.data);
                                        mainUrl = drupal.fullPathFor(rnode[scope.imgField].value.uri);
                                        console.log("cmsImageRef setting src to: " + drupal.thumbnailPathFor(mainUrl, size));
                                        attrs.$set('src', drupal.thumbnailPathFor(mainUrl, size));
                                    },

                                    function (err) {
                                        setErrSrc();
                                    }
                                );
                            } else {
                                setErrSrc();

                            }

                        }

                        element.bind('error', function () {
                            console.log("Failed to load thumbnail for: " + mainUrl);
                            attrs.$set('src', mainUrl);

                        });

                        scope.$watch('refNodeField', function (nval, oval) {

                            if (nval === undefined || nval.value === undefined) {
                                console.log("Undefined  cmsImage ref field, ignoring.");
                                return;
                            }

                            getSrc();

                        }, true);

                    }
                }
            }])

    /**
     * Gets an image directly referenced by a node's field (i.e. a file reference).
     * Handles graceful failover of thumbnail to main image. Can take a
     * locally opened file's if strapped to the value field. Used for loading images without attaching.
     *
     * For version 1.2
     * Accepts node Id for the referenced image and the field the image is on in the referenced node
     */
        .directive('cmsImage', [
            'drupal', '$log', function (drupal, $log) {
                return {
                    restrict: 'A',
                    scope: {
                        imgField: '=',
                        fileSrc: '='
                    },
                    link: function (scope, element, attrs) {

                        var mainUrl;

                        //+ size is set in html like so:  <img cms-image img-field="'field_background_image'" size="large"/>
                        var size = attrs.size;
                        var state = '';


                        function setPlaceholderSrc() {
                            $log.info("cmsImage directive setting placeholder source.")
                            attrs.$set('src', 'assets/img/icons/hex-loader2.gif');
                        }

                        function setErrSrc() {
                            $log.info("cmsImage directive setting error source.")
                            attrs.$set('src', 'assets/img/test/missing_bg.png');
                        }

                        function setSrc() {

                            $log.info("cmsImage directive setSrc called.");

                            if (scope.imgField.value instanceof File) {
                                var fr = new FileReader();
                                fr.onload = function () {
                                    attrs.$set('src', fr.result);
                                };
                                fr.readAsDataURL(scope.imgField.value);
                                $log.info("cmsImage directive setting file source.");

                            }
                            else if (scope.imgField.value.uri !== undefined) {

                                mainUrl = drupal.fullPathFor(scope.imgField.value.uri);
                                $log.info("cmsImage directive setting src to: " + drupal.thumbnailPathFor(mainUrl, size));
                                state = 'thumb';
                                attrs.$set('src', drupal.thumbnailPathFor(mainUrl, size));

                            } else {
                                setErrSrc();
                            }

                        }

                        element.bind('error', function () {
                            if (state == 'thumb') {
                                $log.warn("cmsImage directive failed to load thumbnail for: " + mainUrl);
                                state = 'main';
                                attrs.$set('src', mainUrl);
                            } else {
                                element.unbind('error');
                                setErrSrc();
                            }

                        });

                        scope.$watch('imgField.value', function (nval) {

                            $log.info("cmsImage directive in imgField watch. imgField.value changed");
                            if (nval === undefined) {
                                $log.warn("cmsImage: Undefined  imgField, go away homey.");
                                return;
                            }

                            setSrc();

                        });

                        scope.$watch('fileSrc', function (nval, oval) {

                            $log.info("cmsImage: fileSrc val changed (watch): " + oval + "." + nval);
                            if (nval === undefined || nval.value === undefined) {
                                $log.warn("cmsImage directive: Undefined  fileSrc, go away homey.");
                                return;
                            }

                            setSrc();

                        });

                        setPlaceholderSrc();

                        //setSrc();

                    }
                }
            }])


    /**
     * Trying to fix the spurious digest loop failurs in 1.3+
     *
     * For version 1.2
     * Accepts node Id for the referenced image and the field the image is on in the referenced node
     */
        .directive('cmsImageX', [
            'drupal', '$log', function (drupal, $log) {
                return {
                    restrict: 'A',
                    scope: {
                        imgField: '=',
                        fileSrc: '='
                    },
                    link: function (scope, element, attrs) {

                        var mainUrl;

                        //+ size is set in html like so:  <img cms-image img-field="'field_background_image'" size="large"/>
                        var size = attrs.size;
                        var state = '';


                        function setPlaceholderSrc() {
                            $log.info("cmsImageX directive setting placeholder source.")
                            attrs.$set('src', 'assets/img/icons/hex-loader2.gif');
                        }

                        function setErrSrc() {
                            $log.info("cmsImageX directive setting error source.")
                            attrs.$set('src', 'assets/img/test/missing_bg.png');
                        }

                        function setSrc() {

                            $log.info("cmsImageX directive setSrc called.");

                            if (scope.imgField instanceof File) {
                                var fr = new FileReader();
                                fr.onload = function () {
                                    attrs.$set('src', fr.result);
                                };
                                fr.readAsDataURL(scope.imgField);
                                $log.info("cmsImage directive setting file source.");

                            }
                            else if (scope.imgField.value.uri !== undefined) {

                                mainUrl = drupal.fullPathFor(scope.imgField.uri);
                                $log.info("cmsImageX directive setting src to: " + drupal.thumbnailPathFor(mainUrl, size));
                                state = 'thumb';
                                attrs.$set('src', drupal.thumbnailPathFor(mainUrl, size));

                            } else {
                                setErrSrc();
                            }

                        }

                        element.bind('error', function () {
                            if (state == 'thumb') {
                                $log.warn("cmsImageX directive failed to load thumbnail for: " + mainUrl);
                                state = 'main';
                                attrs.$set('src', mainUrl);
                            } else {
                                element.unbind('error');
                                setErrSrc();
                            }

                        });

                        scope.$watch('imgField', function (nval) {

                            $log.info("cmsImage directive in imgField watch. imgField.value changed");
                            if (nval === undefined) {
                                $log.warn("cmsImageX: Undefined  imgField, go away homey.");
                                return;
                            }

                            setSrc();

                        });

                        scope.$watch('fileSrc', function (nval, oval) {

                            $log.info("cmsImage: fileSrc val changed (watch): " + oval + "." + nval);
                            if (nval === undefined || nval.value === undefined) {
                                $log.warn("cmsImage directive: Undefined  fileSrc, go away homey.");
                                return;
                            }

                            setSrc();

                        });

                        setPlaceholderSrc();

                        //setSrc();

                    }
                }
            }])

    /**
     * Gets a video directly referenced by a node's field (i.e. a file reference).
     * Can take a locally opened file if strapped to the value field. Used for loading videos without attaching.
     *
     * For version 1.2
     * Accepts node Id for the referenced image and the field the image is on in the referenced node
     */
        .directive('cmsVideo', [
            'drupal', '$log', function (drupal, $log) {
                return {
                    restrict: 'A',
                    scope: {
                        vidField: '='
                    },
                    link: function (scope, element, attrs) {


                        function setErrSrc() {
                            $log.error("cmsVideo directive: Something bad happened trying to set the source for this video");
                            //TODO: The code below was meant to display something informative when WMVs appeared
                            //But it broke creating a new asset when there was an error because there was no video

                            //element.after('<div style="text-align: center; line-height: 100px">This video cannot be played in the browser.</div>');
                            //element.remove();
                        }

                        function setSrc() {


                            if (scope.vidField.value instanceof File) {

                                var URL = window.URL || window.webkitURL;
                                attrs.$set('src', URL.createObjectURL(scope.vidField.value));
                                $log.info("cmsVideo directive: Setting source as local file.");

                            }
                            else if (scope.vidField.value.uri !== undefined) {

                                var vidUrl = drupal.fullPathFor(scope.vidField.value.uri);
                                console.log("cmsVideo setting src to: " + vidUrl);
                                attrs.$set('src', vidUrl);
                                $log.info("cmsVideo directive: setting source as URL");

                            } else {
                                setErrSrc();
                                $log.error("cmsVideo directive: source is neither File or URL, this is not cool.");

                            }

                        }

                        element.bind('error', function (foo, bar) {

                            element.unbind('error');
                            setErrSrc();

                        });

                        scope.$watch('vidField.value', function (nval) {

                            if (nval === undefined) {
                                $log.info("cmsVideo directive:  vidField undefined, go away homey.");
                                return;
                            }

                            setSrc();

                        });

                    }
                }
            }])

        .filter('taxonomyString', [
            'cmsModel', function (cmsModel) {
                return function (taxonomyId, noresult) {

                    return cmsModel.taxonomyDict()[taxonomyId] || noresult;

                };
            }])

        .filter('iconFor', function (cmsModel) {
                    return function (type) {

                        switch (type) {
                            case 'video_asset':
                                return 'ion-videocamera';

                            case 'image_asset':
                                return 'ion-image';

                            case 'content_module_container':
                                return 'ion-ios-folder';

                            case 'extended_preso_asset':
                                return 'ion-easel';

                            case 'quote_asset':
                                return 'ion-quote';

                            case 'live_demo_asset':
                                return 'ion-university';

                            case 'file_asset':
                                return 'ion-ios-flask';

                            case 'asset_wrapper':
                                return 'ion-android_drafts';

                            case undefined:
                                return '';

                            default:
                                return 'ion-help';

                        }

                    };
                })

        .filter('nameFor', function (cmsModel) {
                    return function (type) {

                        switch (type) {
                            case 'video_asset':
                                return 'Video';

                            case 'image_asset':
                                return 'Image';

                            case 'content_module_container':
                                return 'Content Module';

                            case 'extended_preso_asset':
                                return 'Presentation';

                            case 'quote_asset':
                                return 'Quote';

                            case 'live_demo_asset':
                                return 'Demo';

                            case 'file_asset':
                                return 'Advanced';

                            case undefined:
                                return '-';

                            default:
                                return '???';

                        }

                    };
                });

})
(window, window.angular);

