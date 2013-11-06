var fs = require('fs');
var jsonpath = require('JSONPath');
var config = module.parent.exports.config;
var moment = require('moment');
var util = require('vcommons').util;
var Log = require('vcommons').log;
var logger = Log.getLogger('FEEDTRANSFORMER', config.log);
 
// NOTE: FEED_GRIDFS_BASEHREF must have the format: "http://localhost:3002/core/fs/";
var FEED_GRIDFS_BASEHREF = config.feed.gridfsBasehref;
var FEED_TITLE = config.feed.title;
var FEED_SUBTITLE = config.feed.subtitle;
var FEED_VERSION = config.feed.version;
var FEED_VRS_BASEHREF = config.feed.basehref;
// NOTE: FEED_REDIRECT_HREF will have the format: "http://localhost?redirectURL="
var FEED_REDIRECT_HREF = config.feed.redirectHref;

var GRIDFS_LABEL = config.feed.gridfsPrefix;		

// NOTE: loading into global space - to avoid asynch, efficiency problem if loading within a method
//logger.trace('Loading file', config.feed.firstPassAtomFeedJsonTemplate);
firstPassOneEntryNLinksFeedTemplate = fs.readFileSync(config.feed.firstPassAtomFeedJsonTemplate);
//logger.trace('firstPassOneEntryNLinksFeedTemplate = '+firstPassOneEntryNLinksFeedTemplate);

//logger.trace('Loading file', config.feed.firstPassAtomEntryJsonTemplate);
firstPassOneEntryNLinksEntryTemplate = fs.readFileSync(config.feed.firstPassAtomEntryJsonTemplate);
//logger.trace('firstPassOneEntryNLinksEntryTemplate = '+firstPassOneEntryNLinksEntryTemplate);


exports.multiJsonDocStrToJsonFeed = function(multiJsonDocStr) {
	logger.trace('vrsFeedTransformer.multiJsonDocStrToJsonFeed() running');
	// parse the JSON Text string into a JavaScript Object
	// Note: throws an err if this won't parse?
	var multiJsonDocJsObj = JSON.parse(multiJsonDocStr);	
	return this.multiJsonDocJsObjJsonFeed(multiJsonDocJsObj);
}

exports.multiJsonDocJsObjToJsonFeed = function(multiJsonDocJsObj) {
	logger.trace('vrsFeedTransformer.multiJsonDocJsObjToJsonFeed() running');	
	var jsonFeedStr;			
	// make a copy of the global template variable so the copy can be edited and used locally
	var jsonFeedTemplateStr = firstPassOneEntryNLinksFeedTemplate; 	
	// parse the first-pass Json Feed Template string into an Javascript Object to update the feed
	// this throws an error if this won't parse
	var jsonFeedJsObject = JSON.parse(jsonFeedTemplateStr);
	// for each json doc in JsObj if any, translate into individual atom feed entries and store in feed in jsonFeedJsObject	
	if (!_.isUndefined(multiJsonDocJsObj) && !_.isEmpty(multiJsonDocJsObj)) {
		var jsonEntriesArr = [];
		// get each json doc in obj
		for(var item in multiJsonDocJsObj) {			
			var curResultJsObj = multiJsonDocJsObj[item];
			// filter the 'uploadDate' and '_id' items out of the result JsObj
			var resultKey, resultProperty;
			for(var resultObjItem in curResultJsObj) {
				if(resultObjItem !== "uploadDate" && resultObjItem !== "_id") {
					resultKey = resultObjItem;
				}
			}
			resultProperty = curResultJsObj[resultKey];			
			var filteredResultJsObj = {};
			filteredResultJsObj[resultKey] = resultProperty;			
			// transform each json doc js obj into an json feed entry js obj			
			var curJsonFeedEntryJsObj = this.niemDocJsObjToJsonEntry(filteredResultJsObj, multiJsonDocJsObj[item]._id, multiJsonDocJsObj[item].uploadDate);
			// store entry in result array
			jsonEntriesArr.push(curJsonFeedEntryJsObj);
		}		
		// set entry(-ies) into the json feed js obj	
		// - if have exactly 1 entry
		if(1 == jsonEntriesArr.length) {
			// set JSON Feed object to one entry, i.e. no JSON array
			var curEntryJsObj = jsonEntriesArr[0];
			jsonFeedJsObject.feed.entry = curJsonFeedEntryJsObj.entry;			
		} else { // - have > 1 entry
			// set JSON Feed object to have multiple entries, i.e. use array 
			var multipleEntriesJsObject = {entry: []};
			for (var i = 0; i < jsonEntriesArr.length; i++) {
				 var curEntryJsObj = jsonEntriesArr[i];
				 multipleEntriesJsObject.entry.push(curEntryJsObj.entry);				 
			}
			jsonFeedJsObject.feed.entry = multipleEntriesJsObject.entry;
		}			
	} else {
		// handle empty multiJsonDocJsObj - remove template entry to return an empty feed	
		delete jsonFeedJsObject.feed.entry;
	}
	// return the feed object
	return jsonFeedJsObject;
};

exports.niemDocJsObjToJsonEntry = function(entryContentJsObj, entryDatabaseIdStr, entryDbUploadDateStr) {
	logger.trace('vrsFeedTransformer.niemDocJsObjToJsonEntry() running');
	var entryJsObj = {"entry": {}};	
	// assume content-type for later
	var entryContentType = "application/xml";	
	// get the entry header values from the entryContentJsObj:	
	// - entry title		
	var entryTitleArr = jsonpath.eval(entryContentJsObj, '$..nc:Document.nc:DocumentDescriptionText');
	if (entryTitleArr.length > 0){
		entryTitle = entryTitleArr[0];
	}
	// - entry id		
	var documentIdentificationArrArr = jsonpath.eval(entryContentJsObj, '$..nc:Document.nc:DocumentIdentification');		
	if(documentIdentificationArrArr.length > 0) {			
		var documentIdentificationArr = documentIdentificationArrArr[0];			
		if (isArray(documentIdentificationArr) && documentIdentificationArr.length > 0) {	
			// have found multiple documentIdentification items	
			var entryDocumentIdentification;
			for (var i = 0; i < documentIdentificationArr.length; i++) {
			    // if nc:DocumentIdentification has no nc:IdentificationCategoryText or no nc:IdentificationCategoryDescriptionText, 
				//    then have the desired entry nc:DocumentIdentification element
				if (documentIdentificationArr[i]["nc:IdentificationCategoryText"] == null) {
					entryDocumentIdentification = documentIdentificationArr[i];
				}
			}
			entryId = entryDocumentIdentification['nc:IdentificationID'];
		} else {
			// have found only one documentIdentification item
			var entryDocumentIdentification = documentIdentificationArrArr[0];
			entryId = entryDocumentIdentification['nc:IdentificationID'];
		} 
	} else {
		// found no documentIdentification items - do nothing
	}	
	// - entry updated date
	var entryUpdatedDateArr = jsonpath.eval(entryContentJsObj, '$..nc:Document.nc:DocumentCreationDate.nc:DateTime');
	if (entryUpdatedDateArr.length > 0){
		entryUpdatedDate = entryUpdatedDateArr[0];
	}
	// - entry author
	var entryAuthorPerson;
	// using nc:Person s:id="two"		
	var entryPersonsArrArr = jsonpath.eval(entryContentJsObj, '$..nc:Person');
	if (entryPersonsArrArr.length > 0) {			
		// get the inner result array of Person items
		var entryPersonsArr = entryPersonsArrArr[0];
		if (isArray(entryPersonsArr)) {
			for (var i = 0; i < entryPersonsArr.length; i++) {					
			    // if nc:Person -s:id == two, then have doc author element
				//logger.trace('entryPersonsArr[i][\"-s:id\"]='+entryPersonsArr[i]["-s:id"]);
				if (entryPersonsArr[i]["-s:id"] == "two") {
					entryAuthorPerson = entryPersonsArr[i];					
				}
			}	
		} else {
			// have found only one nc:Person element
			var entryPerson = entryPersonsArrArr[0];
			//logger.trace('entryPerson[\"-s:id\"]='+entryPerson["-s:id"]);
			if (entryPerson["-s:id"] == "two") {
				entryAuthorPerson = entryPersonsArr[i];					
			}
		}
		if (entryAuthorPerson) {				
			var entryAuthorFirstName = entryAuthorPerson['nc:PersonName']['nc:PersonGivenName'];
			//logger.trace('entryAuthorFirstName = ['+entryAuthorFirstName+']');
			var entryAuthorMiddleInit = entryAuthorPerson['nc:PersonName']['nc:PersonMiddleName'];
			//logger.trace('entryAuthorMiddleInit = ['+entryAuthorMiddleInit+']');
			var entryAuthorLastName = entryAuthorPerson['nc:PersonName']['nc:PersonSurName'];
			//logger.trace('entryAuthorLastName = ['+entryAuthorLastName+']');
			entryAuthor = entryAuthorFirstName + ' ' + entryAuthorMiddleInit + ' ' + entryAuthorLastName; 
		}			
	}				
	if (entryPersonsArrArr.length == 0 || !entryAuthorPerson) {
		// either no nc:Person items where found, or no nc:Person with -s:id== two were found 
		//logger.trace('entryAuthor was not yet found, attempt to find the Org name instead...');
		// ... so try to get entryAuthor from 'nc:DocumentSource.nc:EntityOrganization.nc:OrganizationName'
		var entryAuthorArr = jsonpath.eval(entryContentJsObj, '$..nc:DocumentSource.nc:EntityOrganization.nc:OrganizationName');
		if (entryAuthorArr.length > 0) {
			entryAuthor = entryAuthorArr[0];
		} else {
			// no org name found
			entryAuthor = "Unknown";
		}
	}
	entryAuthor = util.trimStr(entryAuthor);		
	// create the Subject Document link, if possible, and put into entryLinksArr array
	var entryLinksArr = [];
	var gridfsId1RawStr = "";
	var gridfsId1RawArr = jsonpath.eval(entryContentJsObj, '$..nc:Document.nc:DocumentFileControlID');
	if (gridfsId1RawArr.length > 0) {
		gridfsId1RawStr = gridfsId1RawArr[0];
		// remove "gridfs://" if present 		
		var gridfsId1Str = gridfsId1RawStr.toString().replace(GRIDFS_LABEL,"");  			
		var link1HrefStr = FEED_GRIDFS_BASEHREF + '/' + gridfsId1Str;		
		// get matching content-type
		var link1ContentTypeStr;
		var link1ContentTypeArr = jsonpath.eval(entryContentJsObj, '$..nc:Document.nc:DocumentFormatText');
		if (link1ContentTypeArr.length > 0){
			link1ContentTypeStr = link1ContentTypeArr[0];
		} else {
			// no Subject Document link content-type, nc:Document.nc:DocumentFormatText was found - do nothing
		}		
		// create link object and put in entryLinksArr
		var newLinkJsObj = {				
			"title":"Subject Document",
			"type":link1ContentTypeStr,			
			"href":link1HrefStr			
		};
		entryLinksArr.push(newLinkJsObj);
	} else {
		// gridfsId1Raw not found, no Subject Document link - do nothing
	}				
	// find the attachments to get the links for them
	var attachmentsArrArr = jsonpath.eval(entryContentJsObj, '$..nc:Attachment');
	if(attachmentsArrArr.length > 0) {			
		var attachmentsArr = attachmentsArrArr[0];			
		if(isArray(attachmentsArr) && attachmentsArr.length > 1) {
			//logger.trace('multiple attachments found: n='+attachmentsArr.length);
			// use the attachments array
			for (var i = 0; i < (attachmentsArr.length); i++) {						
				var attachmentJsObj = attachmentsArr[0];	
				
				// create the Attachment link
				var linkGridfsIdRawStr = attachmentJsObj['nc:BinaryLocationURI'];
				//logger.trace("linkGridfsIdRawStr="+linkGridfsIdRawStr);	
				// remove "gridfs://" if present 		
				var linkGridfsIdStr = linkGridfsIdRawStr.toString().replace(GRIDFS_LABEL,"");  		
				var linkHrefStr = FEED_GRIDFS_BASEHREF + '/' + linkGridfsIdStr;
				//logger.trace('attachment linkHrefStr = ['+linkHrefStr+']');
				
				// get matching content-type
				var linkTypeStr = attachmentJsObj['nc:BinaryFormatStandardName'];
				//logger.trace('attachment linkTypeStr = ['+linkTypeStr+']');
				
				// create link object and put in entryLinksArr
				var linkJsObj =  {
						"title":"Attachment",
						"type":linkTypeStr,			
						"href":linkHrefStr
					};					
				entryLinksArr.push(linkJsObj);
			}
		} else {							
			var attachmentJsObj = attachmentsArrArr[0];
			//logger.trace('one attachment found');
			
			// create the Attachment link
			var linkGridfsIdRawStr = attachmentJsObj['nc:BinaryLocationURI'];
			//logger.trace("linkGridfsIdRawStr="+linkGridfsIdRawStr);
			// remove "gridfs://" if present 		
			var linkGridfsIdStr = linkGridfsIdRawStr.toString().replace(GRIDFS_LABEL,"");  		
			var linkHrefStr = FEED_GRIDFS_BASEHREF + '/' + linkGridfsIdStr;
			//logger.trace('attachment linkHrefStr = ['+linkHrefStr+']');
			
			// get matching content-type
			var linkTypeStr = attachmentJsObj['nc:BinaryFormatStandardName'];
			//logger.trace('attachment linkTypeStr = ['+linkTypeStr+']');
			
			// create link object and put in entryLinksArr
			var linkJsObj =  {
					"title":"Attachment",
					"type":linkTypeStr,			
					"href":linkHrefStr
				};				
			entryLinksArr.push(linkJsObj);
		}
	} else {
		// no attachments found - do nothing
	}	
	// make the entry JsObj:	
	// - make a copy of the global template variable so the copy can be edited and used locally
	var jsonEntryTemplateStr = firstPassOneEntryNLinksEntryTemplate; 	
	// - parse the Json Feed Template string into an Javascript Object to update the feed
	//   NOTE: this throws an error if this won't parse
	var entryJsObj = JSON.parse(jsonEntryTemplateStr);	
	// - set entry header values
	entryJsObj.entry.title = entryTitle;
	entryJsObj.entry.category["-term"] = entryTitle;
	entryJsObj.entry.id = entryId;
	entryJsObj.entry.published = entryUpdatedDate;
	entryJsObj.entry.updated = entryUpdatedDate;
	entryJsObj.entry.author.name = entryAuthor;	
	// - add this entry content body as a Javascript Object here so it can be properly 
	// 	 added as a JSON child element, not as a string 
	entryJsObj.entry.content = entryContentJsObj;	
	// - set entry's content type 
	entryJsObj.entry.content["-type"] = entryContentType;	
	// - set links
	if (entryLinksArr.length > 0) {		
		if(1 == entryLinksArr.length) {
			// set JSON Feed object to one link, i.e. no JSON array
			var curLinkJsObj = entryLinksArr[0];
			entryJsObj.entry.link["-title"] = curLinkJsObj.title;
			//entryJsObj.entry.link["-href"] = FEED_REDIRECT_HREF+curLinkJsObj.href;
			entryJsObj.entry.link["-href"] = curLinkJsObj.href;
			entryJsObj.entry.link["-type"] = curLinkJsObj.type;
		} else {
			// set JSON Feed object to have multiple links, i.e. use array 
			var multipleLinksJsObj = {link: []};			
			for (var i = 0; i < entryLinksArr.length; i++) {			    
			    var curEntryLinkJsObj = entryLinksArr[i];
			    multipleLinksJsObj.link.push({
			          "-title": curEntryLinkJsObj.title,
			          "-rel": "enclosure",
			          //"-href": FEED_REDIRECT_HREF+curEntryLinkJsObj.href,
			          "-href": curEntryLinkJsObj.href,
			          "-type": curEntryLinkJsObj.type,
			          "-length": "1000000",
			          "-hreflang": "en"
			    });
			}
			entryJsObj.entry.link = multipleLinksJsObj.link;
		}		
	} // else - no links - do nothing: can have items without links
	// return result	
	return entryJsObj;
};

exports.updateEntryLinksInJsonFeed = function(feedJsObj) {
	logger.trace('vrsFeedTransformer.updateEntryLinksInJsonFeed() running');
	// insert the FEED_REDIRECT_HREF link prefix into all feed.entry.link.-href values, if any exist
	var resultFeedJsObj = feedJsObj;	
	if(resultFeedJsObj && resultFeedJsObj.feed && resultFeedJsObj.feed.entry) {
		if(isArray(resultFeedJsObj.feed.entry)) {
			// handle multiple entries
			for(var item in resultFeedJsObj.feed.entry) {
				var curEntryValue = resultFeedJsObj.feed.entry[item];
				if(curEntryValue.link) {
					if (isArray(curEntryValue.link)) {
						for(var linkItem in curEntryValue.link) {
							var curHref = curEntryValue.link[linkItem]["-href"];
							curEntryValue.link[linkItem]["-href"] = FEED_REDIRECT_HREF+curHref;			
						}
					} else {
						var curLink = curEntryValue.link;
						var curHref = curLink["-href"];
						curLink["-href"] = FEED_REDIRECT_HREF+curHref;
					}
				}
			}
		} else {
			// have only one entry
			var curEntryValue = resultFeedJsObj.feed.entry;
			if(curEntryValue.link) {
				if (isArray(curEntryValue.link)) {
					for(var linkItem in curEntryValue.link) {
						var curHref = curEntryValue.link[linkItem]["-href"];
						curEntryValue.link[linkItem]["-href"] = FEED_REDIRECT_HREF+curHref;			
					}
				} else {
					var curLink = curEntryValue.link;
					var curHref = curLink["-href"];
					curLink["-href"] = FEED_REDIRECT_HREF+curHref;
				}
			}
		}
	}
	return resultFeedJsObj;	
}

exports.getEmptyEntryResponseFeedJsObj = function(requestUrlStem, altRequestUrlStem) {
	logger.trace('vrsFeedTransformer.createEmptyEntryResponseFeed() running');
	// make a VRS response feed with values and one stub entry to be filled in or removed later: 
	// make a copy of the global template variable so the copy can be edited and used locally
	var jsonFeedTemplateStr = firstPassOneEntryNLinksFeedTemplate; 	
	// parse the Json Feed Template string into an Javascript Object to update the feed
	// this throws an error if this won't parse
	var finalFeedJsObj = JSON.parse(jsonFeedTemplateStr);	
	// set response feed headers 
	finalFeedJsObj.feed.title["#text"] = FEED_TITLE + " ver. "+FEED_VERSION;
	finalFeedJsObj.feed.subtitle["#text"] = FEED_SUBTITLE;
	finalFeedJsObj.feed.id = FEED_VRS_BASEHREF+requestUrlStem;
	finalFeedJsObj.feed.updated = moment().format(); // TODO: Reset format value?
	finalFeedJsObj.feed.generator["-version"] = FEED_VERSION;
	finalFeedJsObj.feed.generator["-uri"] = FEED_VRS_BASEHREF;
	finalFeedJsObj.feed.generator["#text"] = FEED_TITLE;
	finalFeedJsObj.feed.author = FEED_TITLE + " ver. "+FEED_VERSION;
	finalFeedJsObj.feed.contributor = FEED_TITLE + " ver. "+FEED_VERSION;
	finalFeedJsObj.feed.link[0]["-rel"] = "self";
	finalFeedJsObj.feed.link[0]["-href"] = FEED_VRS_BASEHREF+requestUrlStem;
	finalFeedJsObj.feed.link[1]["-rel"] = "alternate";
	finalFeedJsObj.feed.link[1]["-href"] = FEED_VRS_BASEHREF+altRequestUrlStem;
	return finalFeedJsObj;	
}

exports.aggregateFeedsArrToJsObj = function(finalFeedJsObj, feedJsObjsArr) {
	logger.trace('vrsFeedTransformer.aggregateFeedsJsObj() running');	
	// merge all entries from all feeds given in feedJsObjsArr parameter, 
	//    into the finalFeedJsObj parameter and return the resulting feed
	var updatedFinalFeedJsObj = finalFeedJsObj;	
	if (feedJsObjsArr.length == 0) {
		// no feeds, so no entries, delete entry
		delete updatedFinalFeedJsObj.feed.entry;
	} else if (feedJsObjsArr.length == 1) {
		// one feed 
		updatedFinalFeedJsObj.feed.entry = feedJsObjsArr[0].feed.entry;
	} else { // > 1 feed					
		var multipleEntriesJsObject = {entry: []};
		for (var i = 0; i < feedJsObjsArr.length; i++) {
			var curFeedJsObj = feedJsObjsArr[i];
			// if not an empty entries
			if(curFeedJsObj.feed.entry) {
				// handle multiple entries in one feed
				if (isArray(curFeedJsObj.feed.entry)) {
					for(var i = 0; i < curFeedJsObj.feed.entry.length; i++) {
						multipleEntriesJsObject.entry.push(curFeedJsObj.feed.entry[i]);	
					}				
				} else { 
					// handle one entry in one feed
					multipleEntriesJsObject.entry.push(curFeedJsObj.feed.entry);
				}
			}
		}
		updatedFinalFeedJsObj.feed.entry = multipleEntriesJsObject.entry;		
	}
	return updatedFinalFeedJsObj;
};

function isArray(item) {
    return Object.prototype.toString.call(item) === '[object Array]';
};
