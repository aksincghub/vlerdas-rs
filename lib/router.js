/**
 * Router - For the VLER Read Service
 *
 */
var app = module.parent.exports.app;
var config = module.parent.exports.config;
// Logging
var logger = module.parent.exports.logger;
// Export config, so that it can be used anywhere
module.exports.config = config;

var request = require("request");
var moment = require('moment');
var jsonpath = require('JSONPath');
var async = require('async');
UTIL = {};
UTIL.XML = require('vcommons').objTree;
// Globally available for conversion
var xotree = new UTIL.XML.ObjTree();
var dom = require('xmldom').DOMParser;
var feedTransformer = require('../lib/vrsFeedTransformer.js');

var NODEVRS_BASEHREF = config.feed.basehref;
var NODEVRS_VERSION = config.feed.version; 
var NODEVRS_FEEDTITLE = config.feed.title;
var NODEVRS_FEEDSUBTITLE = config.feed.subtitle;

// GridFS Filenames Regex - 24 chars of lower-case letters a through g and digits only
var bsonIdfilenameRe = new RegExp("^([a-z0-9]{24})$");

// fileExtension Regex - either 2 to 4 alpha-num chars in length after '.', only at end of string
var fileExtRe = new RegExp("(\.[a-zA-Z0-9]{2,4})$");

 
var Router = function () {
	var _self = this;        
}

Router.prototype.processServices = function(req, res, next) {
	logger.trace('in processServices() for reqType: '+res.locals.reqType);
	
	// only work with a 1P request, else pass on		
	if(res.locals.reqType == '1P') {
		// process this service only for 1P responses for now
		
		// make the service call(s) if any
		
		// get the service endpoint's producer name to make the call, by getting it from routeDef.serviceList		
		var serviceListArr = res.locals.routeDef.serviceList;		
		// TODO: Decide whether to iterate and handle multiple service requests, and what to do with the responses if so - set loop or async code here if yes		
		if (serviceListArr[0]) {
			var curRouteDefService = serviceListArr[0];
			var curServiceEndpoint;
			var curServiceName;
			if(curRouteDefService) {
				var curServiceName = curRouteDefService.producerName;
				// TODO: get requiredQueryParam, optionalQueryParams here and check them against those in res.locals.queryParams, and then get param values from queryParams?
				// get service endpoint information
				curServiceEndpoint = _.find(config.endpoints, function(endpoint) { return (endpoint.producerName == curServiceName && endpoint.type == "SVC"); });
			}
			var curServiceBaseHref = curServiceEndpoint.basehref;	
			
			// if is a pix service, set received cid to be converted into requestURL 
			if (curServiceName && (curServiceName.indexOf("pix") != -1)) { 
				 var requestURL = curServiceBaseHref+"/"+res.locals.cid;
				// get options from curServiceEndpoint.options, and create the requestOptions obj with the requestUri set
				 var requestOptions = curServiceEndpoint.options;
				 requestOptions.uri = requestURL;				 
				 var newAA;
				 var newCID;
				 logger.trace('in processServices() - making 1P service call to service endpoint: ',curServiceName,' with request url: ',requestOptions.uri);
				 // make the svc request using the requestURL and requestOptions
				 var curRequest = request(requestOptions, function (err, response, body) {
					  if (err) { 
						  //throw new Error('Unable to complete request to: '+curServiceName+' service at: '+curServiceBaseHref+' due to error: '+err);
						  logger.error('in processServices() - Unable to complete request to: '+curServiceName+' service at: '+curServiceBaseHref+' due to error: '+err.stack);
						  res.locals.statusCode = 500;
						  return next();
					  } else {
						  var statCode = "unknown";
						  if (response && response.statusCode) {
							  statCode = response.statusCode;
						  }
						  if(statCode != 200) {
							    // handle any failure responses here:						  
				      		    //throw new Error('Unable to complete request to '+curServiceName+' service at: '+curServiceBaseHref+' due to failure response status returned from service of value: '+statCode);
							    logger.error('in processServices() - Unable to complete request to '+curServiceName+' service at: '+curServiceBaseHref+' due to failure response status returned from service of value: '+statCode);
				      		    res.locals.statusCode = 500;
				      		    return next();
				      	  }	else {
				      		  	// process good response: check for id returned with MULTIPLE or UNKNOWN values, or get the successful translated response value
					      		var responseBodyJSObj = JSON.parse(body);
					      		newAA = jsonpath.eval(responseBodyJSObj, '$..vler:Client.vler:ClientIdentifier[0].vler:AssigningAuthority');
					      		newCID = jsonpath.eval(responseBodyJSObj, '$..vler:Client.vler:ClientIdentifier[0].nc:IdentificationID');
					      		if (!_.isUndefined(newCID)) {
						      		if(newCID.indexOf("MULTIPLE") != -1) {
						      			// TODO: set '400' response to be returned - and skip ahead to processResponse()!
						      			// store the value in request context
						      			res.locals.statusCode = 400;	
						      			logger.error('in processServices() - 1P service call to service endpoint: ',curServiceName,' failed, returned: '+MULTIPLE);
						      		} else if (newCID.indexOf("UNKNOWN") != -1) {
						      			// TODO: set '404' response to be returned - and skip ahead to processResponse()!
						      			// store the value in request context
						      			res.locals.statusCode = 404;	
						      			logger.error('in processServices() - 1P service call to service endpoint: ',curServiceName,' failed, returned: '+UNKNOWN);
						      		} else {
						      			// result was a success!
						      			logger.trace('in processServices() - 1P service call to service endpoint: ',curServiceName,' was a success!');
						      			// store the values in request context
						      			res.locals.statusCode = 200;
						      			res.locals.altAA = newAA;
						      			res.locals.altCID = newCID;				      			
						      		}
						      		return next();	
					      		} else { // newCID is undefined
					      			//throw new Error('Unable to complete request to '+curServiceName+' service at: '+curServiceBaseHref+' due to empty vler:Client.vler:ClientIdentifier[0].nc:IdentificationID in response!');
					      			logger.error('in processServices() - Unable to complete request to '+curServiceName+' service at: '+curServiceBaseHref+' due to empty vler:Client.vler:ClientIdentifier[0].nc:IdentificationID in response!');
					      		    res.locals.statusCode = 500;
					      		    return next();
					      		}
				      	  }
					  }
				});
			} else { // else: is an unknown service: don't make any service calls
				// pass to next method
				return next();	
			}
		} else {// else: don't make any service calls
			// pass to next method
			return next();	
		}
	} else {// else: ignore all but first-pass requests for now
		// pass to next method
		return next();	
	}
};

Router.prototype.process1PResponse = function(req, res, next) {
	logger.trace('in process1PResponse() for reqType: '+res.locals.reqType);	
	// only work with a  res.locals.statusCode setting of "200"/Success, else pass on;		
	// only work with a 1P request, else pass on		
	if((res.locals.statusCode == 200) && (res.locals.reqType == '1P')) {
		// process this 1P response:
		// create the request uri and options info for each producer in producerList; 
		// then call each first-pass Producer in producerList in parallel to get their response, if any, 
		// handling any errors by returning them and halting all the producer calls, 
		// and passing err onto sendSupportedResponse; 
		// else aggregate responses into one feed string, and store final outcome into 
		// res.locals.items to pass onto sendSupportedResponse.		
		
		// create the task input items array for the async.map iterator method to use
		var producerTaskItemsArr = [];
		
		// for now: distinguish between ecrud and wrapper requests using 'cache=true' or no 'cache' for ecrud request,
		// and 'cache=false' for non-ecrud requests		
		var isEcrudOnlyRequest = true;
		if ((req.query.cache == "false") || (res.locals.queryStr && res.locals.queryStr.indexOf("cache=false") != -1)) {
			// have a producer endpoint request
			isEcrudOnlyRequest = false;			
		} // else have an ecrud request			
		logger.trace('in process1PResponse() - isEcrudOnlyRequest='+isEcrudOnlyRequest);
		
		// select aa, cid
		var reqAA;
		var reqCID;	
		if(res.locals.altAA && res.locals.altCID) {
			// use the translated values
			reqAA = res.locals.altAA;
			reqCID = res.locals.altCID;
 		} else {
			// use the original request values
			reqAA = res.locals.aa;
			reqCID = res.locals.cid;
		}		
		// set local producerQueryStr if exists and edit it
		var producerQueryStr = "";		
		if (!_.isUndefined(res.locals.queryStr) && !_.isEmpty(res.locals.queryStr)) {
			// add the '?'
			var queryStr = "?"+res.locals.queryStr;
			// remove 'cache' parameter if it exists
			producerQueryStr = removeQueryParameter(queryStr,"cache");
		}		
		// set requestStem for this producer
		// NOTE: placing every other parameter received into query string (except any 'cache' received)				
		requestStem = "/"+reqAA+"/"+reqCID+res.locals.routeDef.cpath+producerQueryStr;				
		// for each producer in routeDef.producerList
		var producerListArr = res.locals.routeDef.producerList;
		for (var i=0; i < producerListArr.length; i++) {			
			// get matching producer endpoint for each producerList item from config, to put in curItem 
			var curProducerName = producerListArr[i].producerName;
			// make request URL's request stem
			var requestStem;
			if ((curProducerName.indexOf("ecrud") != -1) && isEcrudOnlyRequest) {
				// parse query params into query string for eCRUD:				
				var currentQueryStr;
				// if no 'json' or 'query' parameter given, use the defaultQuery as a 'query=' parameter value
				if(!req.query.query && !req.query.json) {					
					// get the default query= value
					var currentQueryStr = producerListArr[i].defaultQuery;
					// set aa, cid values in query= value					
					// if have alt aa, cid values ...
					if(res.locals.altAA && res.locals.altCID) {
						// use them
						currentQueryStr = currentQueryStr.replace(/theCIDValue/g, res.locals.altCID);
						//currentQueryStr = currentQueryStr.replace(/theAAValue/g, res.locals.altAA);
					} else {
						// use original aa, cid values
						currentQueryStr = currentQueryStr.replace(/theCIDValue/g, res.locals.cid);
						//currentQueryStr = currentQueryStr.replace(/theAAValue/g, res.locals.aa);
					}
				} else {
					// have either query or json query parameter (or both!?), so 
					// use producerQueryStr with users values and hope it works
					currentQueryStr = producerQueryStr;
				}				
				// set requestStem for this producer
				requestStem = "/"+producerListArr[i].producerCpath+"?query="+currentQueryStr;			
				// get the current producer endpoint matching curProducerName for the request from config.endpoints
				curProducerEndpoint = _.find(config.endpoints, function(endpoint) { return (endpoint.producerName == curProducerName && endpoint.type == "1P"); });
				// make the curItem and store in items array
				var curItem = { "requestStem": requestStem, "requestQParams": res.locals.queryParams, "producerRouteDef": producerListArr[i], "producerEndpoint": curProducerEndpoint };
				producerTaskItemsArr.push(curItem);
			} else if ((curProducerName.indexOf("ecrud") == -1) && !isEcrudOnlyRequest) {
				curProducerEndpoint = _.find(config.endpoints, function(endpoint) { return (endpoint.producerName == curProducerName && endpoint.type == "1P"); });
				// make the curItem and store in items array
				var curItem = { "requestStem": requestStem, "requestQParams": res.locals.queryParams, "producerRouteDef": producerListArr[i], "producerEndpoint": curProducerEndpoint };
				producerTaskItemsArr.push(curItem);
			} 		
		}
		// if producerTaskItemsArr is empty, flag error
		if (producerTaskItemsArr.length == 0) {
			// set 404/Not Found and pass on - TODO: should this be 400?
			res.locals.statusCode = 404;
			logger.error('in process1PResponse() - no 1P producer tasks set, possibly from query parameter values not matching defined producers');
		}
		
		//async API: async.map(arr, iterator, callback);
		// arr = array of items passed to iterator function
		// iterator = function(item, callback) - function to apply to each item in the given array
		// - task callback =  callback(err, result) - must be called once iterator has completed with an error (which can be null) and a transformed item.
		// callback = final callback = callback(err, resultsArr) 		
		
		// if no error flagged
		if(res.locals.statusCode == 200) {
			// make the 1P producer call(s) in parallel		
			async.map(producerTaskItemsArr, callFirstPassProducer, function handleFirstPassResponses(err, resultsArr) {
				logger.trace('in process1PResponse() - 1P producer calls finished or halted early...');						
				if(err) {
					var customErrResponseStr = JSON.stringify(err);
					logger.error("in process1PResponse() - Halted all first-pass producers calls: Error thrown in async.map() for a producer in first-pass producers call!, error thrown: "+customErrResponseStr); 
					// halt execution for everything so no document meta-data is missed because of individual producer problems
					// (i.e. assumes proper queries with no results found will receive a status of "200" and an empty feed, or for ecrud, an empty JsObj)
					res.locals.statusCode = err.endpointError.errorCode;
					// set res.locals.items = err, which is the customErrResponse, and return next() to handle error responses in sendSupportedResponse() method
					res.locals.items = err;
					return next();
				} else { // have either successes or producer-returned error responses as results in resultsArr
					logger.trace("in process1PResponse() - All 1P producer calls finished");
					// use to store all of the results' status codes
					var resultsStatusCodesArr = [];
					// use to store individual success responses as individual xml feed strings in intermediateFeedResultsArr
					var intermediateFeedResultsArr = [];
					// for each result received
					for (var i=0; i < resultsArr.length; i++) {
						// get matching producer endpoint for each producerList item to handle each response properly
						var curProducerName = producerTaskItemsArr[i].producerEndpoint.producerName;	
						// handle the matching result for each producer in producerList
						var curResult = resultsArr[i];						
						if (curResult.endpointError) {
							// handle any error result responses
							var customErrResponseStr = JSON.stringify(curResult);
							logger.error("in process1PResponse() - received an HTTP response error status code for 1P producer call to producer: "+curResult.endpointError.producerName+", error thrown: "+customErrResponseStr); 
							// store error status code
							resultsStatusCodesArr.push(curResult.endpointError.errorCode);
						} else {
							// handle success response (either full or empty)
							logger.trace("in process1PResponse() - received success response from producer: "+curProducerName);
							// store success status code
							resultsStatusCodesArr.push(200);
							// handle any success result bodies
							// if producer name contains 'ecrud'... transform those from eCRUD into a feed string 
							if (curProducerName.indexOf("ecrud") != -1) {
								// ecrud 1P response should be JSON from a VLER SOR collection path							
								//console.log('ecrud result: ',curResult);
								// TODO: What if curResult empty?
								var ecrudResultJsObj = JSON.parse(curResult);		
								// test if anything found in VLER SOR collection -- TODO: Need this?
								if (!_.isUndefined(ecrudResultJsObj) && !_.isEmpty(ecrudResultJsObj)) {										
									// transform ecrud result json js obj into an atom feed js obj
									var curResultJsonFeedJsObj = feedTransformer.multiJsonDocJsObjToJsonFeed(ecrudResultJsObj);																
									// store json feed js obj
									intermediateFeedResultsArr.push(curResultJsonFeedJsObj);	
								} else {
									// no results from ecrud - only need an empty, temporary json feed js obj 
									intermediateFeedResultsArr.push({"feed":{}});
								}							
							} else {
								// is endpoint producer, so response should be an atom feed/xml string ( NOTE: may be an empty feed)	
								// - transform xml feed str into a json feed Js Obj for easier feed result merging with Javascript
								var curResultJsonFeedJsObj = xotree.parseXML(curResult);							
								// store json feed js obj
								intermediateFeedResultsArr.push(curResultJsonFeedJsObj);
							}			
						}												
					}
					// set the final response status code based on all first-pass results	
					logger.trace("in process1PResponse() - received 1P producers results status codes: "+JSON.stringify(resultsStatusCodesArr));
					// find if all success (200's) or not were returned
					var haveAllSuccesses = true;
					for (var i=0; i < resultsStatusCodesArr.length; i++) {
						if (resultsStatusCodesArr[i] != 200) {
							haveAllSuccesses = false;
							break;
						}
					}
					// if not all successes returned, figure out the response code
					if(!haveAllSuccesses) {
						// if have at least one success but not all
						if (resultsStatusCodesArr.indexOf(200) > -1) {
							// partial success
							res.locals.statusCode = 206;
						} else {
							// all error codes - flag 500 if even one in there, else 400 if one, else 404
							if (resultsStatusCodesArr.indexOf(500) > -1) {
								res.locals.statusCode = 500;
							} else if(resultsStatusCodesArr.indexOf(400) > -1) {
								res.locals.statusCode = 400;
							} else {
								res.locals.statusCode = 404;
							}					
						}						
					} else {
						// all successes - set as 200
						res.locals.statusCode = 200;
					}	
					logger.trace("in process1PResponse() - have set the final 1P response status code:",res.locals.statusCode)
					// get final feed 
					// - get request stem values here
					var requestUrlStem = req.url;
					if(res.locals.altAA && res.locals.altCID) {
						var altRequestUrlStem = requestStem; // use the altAA, altCID values  
					} else {
						// use only VRS basehref
						var altRequestUrlStem = "";
					}
					// - create the final feed
					var finalFeedJsObj = feedTransformer.getEmptyEntryResponseFeedJsObj(requestUrlStem, altRequestUrlStem);					
					// aggregate any success response json feed js objs in intermediateFeedResultsArr into one final response xml feed string and store into res.local.items				
					// get all of the entry(-ies) in each xml feed str and merge them into one
					// NOTE: any "de-duplication" feature for the entries would have to go here after the merge
					var final1PResultsJsonFeedJsObj = feedTransformer.aggregateFeedsArrToJsObj(finalFeedJsObj, intermediateFeedResultsArr);
					// add the FEED_REDIRECT_HREF prefix to any feed.entry.link.-href values in json feed JsObj
					final1PResultsJsonFeedJsObj = feedTransformer.updateEntryLinksInJsonFeed(final1PResultsJsonFeedJsObj);
					// detect desired response format - json or not (default is atom feed xml)
					var final1PResultStr;					
					var requestAccept = req.headers['accept']; 
					if (requestAccept && (requestAccept.indexOf("application/json") != -1)) {
						// then leave as json - as string
						final1PResultStr = JSON.stringify(final1PResultsJsonFeedJsObj);
					} else { 					
						// convert final response feed into an xml feed string - this is the default format
						final1PResultStr = xotree.writeXML(final1PResultsJsonFeedJsObj);
					}					
					// set response in res.locals.items
					res.locals.items = final1PResultStr;					
					// pass to next method
					return next();	
				}
			});		
		} else {
			// pass to next method
			return next();	
		}
	} else {// else: ignore all but first-pass requests 
		// pass to next method
		return next();	
	}
};

function callFirstPassProducer(producerTaskItem, callback) {
	logger.trace('in callFirstPassProducer()');	
	var producerName = producerTaskItem.producerRouteDef.producerName;			
	// make the call with request to the producer 	
	// - get basehref from producerEndpoint.basehref and make the final request URL
	var producerBasehref = producerTaskItem.producerEndpoint.basehref;
	var requestURL = producerBasehref + producerTaskItem.requestStem;
	// - NOTE: if validating query params from routeDef is desired, it would be done here, and if param value known, key would be used to set value into request URL	
	// - get options from producerEndpoint.options, and create the requestOptions obj with the requestUri set
	var requestOptions = producerTaskItem.producerEndpoint.options;
	requestOptions.uri = requestURL;	
	// - make the actual call to the producer with request
	logger.trace('in callFirstPassProducer() - making 1P producer call to 1P producer endpoint: ',producerName,' with request url: ',requestURL);
	var curRequest = request(requestOptions, function process1PEndpointResponse(err, response, body) {
		  if (err) { 
			  //logger.error('callFirstPassProducer() for producer: '+producerName+' threw an error!: '+err.stack);			  
			  //return callback(err, resultItem);
			  // store the error here to return now - other producers will not complete
			  var customErrResponse = {"endpointError": { "errorCode": "500", "producerName": producerName, "url": requestURL, "body": err.stack}};			  
			  return callback(customErrResponse, null);
		  } else {	
			  if (response.statusCode != 200) {
				  // store the error here to return now - other producers will not complete
				  var customErrResponse = {"endpointError": { "errorCode": response.statusCode, "producerName": producerName, "url": requestURL, "body": body}};
				  return callback(null, customErrResponse);
			  } else {
				  // success - statusCode == 200
				  return callback(null, body);
			  }
		  }
	 });	
};

// modified from: 
// http://stackoverflow.com/questions/1634748/how-can-i-delete-a-query-string-parameter-in-javascript
// by "bobince", on: Oct 28 '09 at 2:19 
function removeQueryParameter(queryStr, parameterName) {
	var resultQueryStr;
	// replace all '&amp;' values with a '&'
	queryStr = queryStr.replace(/&amp;/g,'&')
	var urlparts= queryStr.split('?');   //prefer to use l.search if you have a location/link object
	if (urlparts.length>=2) {
	    var prefix= encodeURIComponent(parameterName)+'=';
	    var pars= urlparts[1].split(/[&;]/g);
	    for (var i= pars.length; i-->0;) {              // reverse iteration as may be destructive
	    	
	        if (pars[i].lastIndexOf(prefix, 0)!==-1) {  // idiom for string.startsWith
	            pars.splice(i, 1);
	        }
	    }
	    if (pars && pars.length == 0) {
	    	// no remaining query params, so don't include a '?'
	    	resultQueryStr = '';
	    } else {
	    	resultQueryStr='?'+pars.join('&');
	    }
	}
	return resultQueryStr;
}

Router.prototype.process2PResponse = function(req, res, next) {
	logger.trace('in process2PResponse() for reqType: '+res.locals.reqType);	
	// only work with a 2P request, else pass on	
	if((res.locals.statusCode == 200) && (res.locals.reqType == '2P')) {	
		// make the request url only here and then set request info to pass it onto sendSupportedResponse, 
		// and there do producer request with pipe and return in one step!				
		// create 2p url, and then set request info:
		// - get file id for orig request
		var sPFilename = res.locals.fileId;
		// if (fileid not null)
		if(sPFilename) {			 
			// split on '_' to decode filename 
			var splitArr = sPFilename.split('_');
			// can only have 3 elements for a valid filename
			if (splitArr.length == 3) {
				var homeCommunityId = splitArr[0];
				var remoteRepositoryId = splitArr[1];
				var documentUniqueId = splitArr[2];
				// NOTE: Only uncomment and use this fileExtension code if needed
				// set optional file extension value (e.g. .xml)
//				var fileExtension;
//				if (fileExtRe.test(documentUniqueId)) {
//					// hava fileExt, so split fileExt out
//					var matchArray = fileExtRe.exec(documentUniqueId);
//					fileExtension = matchArray[0];
//					documentUniqueId = documentUniqueId.substr(0, documentUniqueId.indexOf(fileExtension)); 					
//				}					
				// using the homeCID and remoteRepoId, along with the routeDef.producerList and their matching endpoints information, 
				// determine the correct 2p producer to call, and use this information to create and store the requestURL and requestProducerName
				var requestURL;
				var requestProducerName;				
				var producerListArr = res.locals.routeDef.producerList;
				for (var i=0; i < producerListArr.length; i++) {						
					// use curProducer to get endpoint producer 
					var curProducer = producerListArr[i];
					// if request homeCID and request remoteRepoId and '2P' match the same values in the endpoint producer, then use this producer
					// e.g. in sPFilname: if homeCID = va, and remoteRepoId = 'vlersor', and type = '2P', then have the 2P producer:
					var spProducerEndpoint = _.find(config.endpoints, function(endpoint) { return (endpoint.producerName == curProducer.producerName); });
					if(spProducerEndpoint) {
						if(homeCommunityId === spProducerEndpoint.homeCommunityId && remoteRepositoryId === spProducerEndpoint.remoteRepositoryId && '2P' === spProducerEndpoint.type) {
							if(spProducerEndpoint.producerName.indexOf("ecrud") != -1) {
								// if ecrud_2P producer, set 2p endpoint basehref and set only the documentUniqueId as the "id" (and not the optional fileExtension element) ?
								// TODO: Test documentUniqueId for bsonFileId regex match and throw 404 if not matched?
								// define the ecrud request values					
								requestURL = spProducerEndpoint.basehref + "/" + documentUniqueId;
							} else {
								// use endpoint basehref, cpath, and full 3-part filename + option fileExt value to make request url - with remote endpoint basehref
								requestURL = spProducerEndpoint.basehref + "/" + req.params.aa + "/" + req.params.cid + "/" + res.locals.routeDef.cpath + "/" + sPFilename;
							}		
							// set producer name
							requestProducerName = spProducerEndpoint.producerName;
							break;
						} // else spProducerEndpoint was found for curProducerName, but homeCID, remoteRepoID, and type not matched for curProducerName, so try the next producer in producerList	
					} // else spProducerEndpoint not found for curProducerName, so try the next producer in producerList	
				}		
				// if no 2P producer found to matched for request sPFilename, then ...
				if (!requestProducerName) {
					// flag 404/Not Found and pass on
					res.locals.statusCode = 404;
					logger.error("in process2PResponse() - no 2P producer matched in routeDef.producerList for 2P request fileId: "+sPFilename+", returning Not Found response");
				} else {
					// store 2p request url and producer name into res.locals, flag success, and pass on		
					res.locals.sPReqUrl = requestURL;
					res.locals.sPProducerName = requestProducerName;
					res.locals.statusCode = 200;	
					logger.trace("in process2PResponse() - setting 2P producer name: "+requestProducerName+" and 2P producer request URL: "+requestURL)
				}							
			} else {
				// set 404/Not Found and pass on
				res.locals.statusCode = 404;
				logger.error("in process2PResponse() - received an incorrect filename format for 2P request with fileId: "+sPFilename+", returning Not Found response");
			}
		} else {
			// set 500/Internal Server Error and pass on
			res.locals.statusCode = 500;
			logger.error("in process2PResponse() - no filename set for 2P request!, returning Internal Server Error response");
		}
	}	
	// pass to next method 
	next();
};

// NOTE: the last method in the callback chain
Router.prototype.sendSupportedResponse = function(req, res, next) {
	logger.trace('in sendSupportedResponse() for reqType: '+res.locals.reqType+' with initial response statusCode: '+res.locals.statusCode);
	// get response status code in case set
	var responseStatusCode = '500';
	if(res.locals.statusCode) {
		responseStatusCode = res.locals.statusCode;
	}			
	// if first-pass
	if(res.locals.reqType && res.locals.reqType == '1P') {	
		// for 1P: either return feed with 200, or return an error response if set
		var body = res.locals.items;		
		if (!body || (responseStatusCode != 200 && responseStatusCode != 206)) {	
			// set error response, take error out of response for security
			body = "";
			// must set a content-type for REST responses
			res.contentType('text/plain');			
			if((responseStatusCode == 404) || responseStatusCode == 400) {
				 var currentDateStr = moment().format();
				 body = '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.w3.org/2005/Atom ../XMLschemas/atom/2005/vler/0.2/atom.xsd">'
			    	 	+'<title type="text">'+NODEVRS_FEEDTITLE+' ver. '+NODEVRS_VERSION+'</title><subtitle type="text">'+NODEVRS_FEEDSUBTITLE+'</subtitle><author><name>'+NODEVRS_FEEDTITLE+' ver. '+NODEVRS_VERSION+'</name></author><contributor><name>'+NODEVRS_FEEDTITLE+' ver. '+NODEVRS_VERSION+'</name>'
			    	 	+'</contributor><updated>'+currentDateStr+'</updated><generator uri="'+NODEVRS_BASEHREF+'/das/v1/" version="'+NODEVRS_VERSION+'">'+NODEVRS_FEEDTITLE+' ver. '+NODEVRS_VERSION+'</generator><id>'+NODEVRS_BASEHREF+req.url+'</id>'
			    	 	+'<link href="'+NODEVRS_BASEHREF+req.url+'" rel="self"/><link href="'+NODEVRS_BASEHREF+'/das/v1/" rel="alternate"/>'
			    	 	+'</feed>';
			     // re-set content-type for 1P response
			     res.contentType('application/atom+xml');	
			} else if (responseStatusCode == 500) {
				body = "HTTP/1.1 500 INTERNAL SERVER ERROR";
			} // else, return some unknown statusCode with an empty body
			logger.trace("in sendSupportedResponse() - returning 1P error response of statusCode: "+responseStatusCode+' with Content-Type: '+res.getHeader('Content-Type')+' of length: '+body.length+' for request: '+req.url);
		} else {
			// set the success or partial success response			
			res.contentType('application/atom+xml');
			logger.trace("in sendSupportedResponse() - returning 1P success response of statusCode: "+responseStatusCode+' with Content-Type: '+res.getHeader('Content-Type')+' of length: '+body.length+' for request: '+req.url);
		}
		res.charset = 'utf-8'; 
		res.setHeader('Content-Length', body.length);
		res.send(responseStatusCode, body);
	} else if(res.locals.reqType && res.locals.reqType == '2P') { // else if second-pass 
		// for 2P: both make the call to producer and return the stream	here to enable the 'pipe()' call		
		if(responseStatusCode == 200 && res.locals.sPReqUrl) {	    
			var requestProducerName = res.locals.sPProducerName;
			var requestURL = res.locals.sPReqUrl;
			var remoteProducerEndpoint = _.find(config.endpoints, function(endpoint) { return (endpoint.producerName == requestProducerName); });
			// set content type as default value for success case
			res.contentType('application/octet-stream');
			// - get options from remoteProducerEndpoint.options, and create the requestOptions obj with the requestUri set
			var requestOptions = remoteProducerEndpoint.options;
			requestOptions.uri = requestURL;			 
			// create the request
			var endpointRequest = request(requestOptions, function process2PEndpointResponse(err, response, body) {
				  if (err) { 					  		  
					  // store the error here to return now - producer call has thrown a connection error
					  var customErrResponse = {"endpointError": { "errorCode": "500", "producerName": requestProducerName, "url": requestURL, "body": err.stack}};
					  var customErrResponseStr = JSON.stringify(customErrResponse);
					  logger.error('in sendSupportedResponse() - 2P request call - for producer: '+requestProducerName+' threw an error!: '+customErrResponseStr);	
					  return;
				  } else {	
					  if (response.statusCode != 200) {
						  // store the error here to return now - producer has returned a failure status code
						  var customErrResponse = {"endpointError": { "errorCode": response.statusCode, "producerName": requestProducerName, "url": requestURL, "body": body}};
						  var customErrResponseStr = JSON.stringify(customErrResponse);
						  logger.error('in sendSupportedResponse() - returning 2P error response of statusCode: '+response.statusCode+' from producer: '+requestProducerName+' for request: '+req.url+' where received producer error: '+customErrResponseStr);
						  return;
					  } else {
						  // success - statusCode == 200						  
						  logger.trace('in sendSupportedResponse() - returning 2P success response of statusCode: 200 with Content-Type: '+res.getHeader('Content-Type')+' with Content-Disposition: '+res.getHeader('Content-Disposition')+' from producer: '+requestProducerName+' for request: '+req.url);
						  return;
					  }
				  }
			 });		    
			// process and return the response with the same headers as received	 
			endpointRequest.pipe(res);				
		} else { 
			// 500/Internal Server Error and pass on
			responseStatusCode = 500;
		}	
		// make the error response instead if any are set
		if (responseStatusCode != 200) {
			// have an error, so return			
			body = "";
			if(responseStatusCode == 404) {
				body = "HTTP/1.1 404 NOT FOUND";
			} else if (responseStatusCode == 400) {
				body = "HTTP/1.1 400 BAD REQUEST";
			} else if (responseStatusCode == 500) {
				body = "HTTP/1.1 500 INTERNAL SERVER ERROR";
			}
			res.setHeader('Content-Length', body.length);
			// must set content-type for REST response
			res.contentType('text/plain');
			res.charset = 'utf-8'; 
			logger.trace('in sendSupportedResponse() - returning 2P error response of statusCode: '+res.statusCode+' with Content-Type: '+res.getHeader('Content-Type')+' without making producer call for request: '+req.url);
			res.send(responseStatusCode, body);
		}		
	}  // else do nothing and pass on 	
};

Router.prototype.sendUnsupportedResponse = function(req, res, next) {
	logger.trace('in sendUnsupportedResponse() for reqType: '+res.locals.reqType+' with initial response statusCode: '+res.locals.statusCode);
	// if not a 1P request or 2P request, return the unsupported response
	if(!res.locals.reqType || (res.locals.reqType != '1P' && res.locals.reqType != '2P')) {
		// return "unsupported" cpath response
		var requestAccept = req.headers['accept'];
		// -- can't tell if 1P or 2P, so check Accept: if it has anything other than application/atom+xml or application/xml, assume 2P was intended	 
		if (requestAccept && ((requestAccept.indexOf("application/atom+xml") != -1)  || (requestAccept.indexOf("application/xml") != -1) || (requestAccept.indexOf("text/xml") != -1))) {
				// return first-pass Unsupported response - application/atom+xml
			     var currentDateStr = moment().format();
			     // return the Unsupported Atom Feed response as an html entry message Atom Feed
			     body = '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.w3.org/2005/Atom ../XMLschemas/atom/2005/vler/0.2/atom.xsd">'
			    	 	+'<title type="text">'+NODEVRS_FEEDTITLE+' ver. '+NODEVRS_VERSION+'</title><subtitle type="text">'+NODEVRS_FEEDSUBTITLE+'</subtitle><author><name>'+NODEVRS_FEEDTITLE+' ver. '+NODEVRS_VERSION+'</name></author><contributor><name>'+NODEVRS_FEEDTITLE+' ver. '+NODEVRS_VERSION+'</name>'
			    	 	+'</contributor><updated>'+currentDateStr+'</updated><generator uri="'+NODEVRS_BASEHREF+'/das/v1/" version="'+NODEVRS_VERSION+'">'+NODEVRS_FEEDTITLE+' ver. '+NODEVRS_VERSION+'</generator><id>'+NODEVRS_BASEHREF+req.url+'</id>'
			    	 	+'<link	href="'+NODEVRS_BASEHREF+req.url+'" rel="self"/><link href="'+NODEVRS_BASEHREF+'/das/v1/" rel="alternate"/>'
			    	 	+'<entry><title type="html">Unsupported Request Error</title><content type="html">&lt;p&gt;There is no supported response for this request in VRS.&lt;/p&gt;</content><author><name>'+NODEVRS_FEEDTITLE+' ver. '+NODEVRS_VERSION+'</name></author><contributor>'
			    	 	+'<name>'+NODEVRS_FEEDTITLE+' ver. '+NODEVRS_VERSION+'</name></contributor><published>'+currentDateStr+'</published><updated>'+currentDateStr+'</updated></entry></feed>';
			     // must set content-type for REST response
			     res.contentType('application/atom+xml');	
		} else {
			 // return second-pass Unsupported response
			 // no body to return
			 var body="HTTP/1.1 404 NOT FOUND";	     
		     // must set content-type for REST response
		     res.contentType('text/plain');	    
		}
		res.setHeader('Content-Length', body.length);	
		res.charset = 'utf-8'; 
		logger.trace('in sendUnsupportedResponse() - returning Unsupported Resource response of statusCode: 404 with Content-Type: '+res.getHeader('Content-Type')+' of length: '+body.length+' for request: '+req.url);
		res.send(404, body);    
	} // else: is a supported request	
	// pass on
    next();	
};

function isArray(item) {
    return Object.prototype.toString.call(item) === '[object Array]';
}

module.exports = Router;

