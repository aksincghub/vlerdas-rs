var should = require('should');
var fs = require('fs');
var config = require('config');
module.exports.config = config;

var feedTransformer = require('../lib/vrsFeedTransformer.js');


describe('niemDocJsObjToJsonEntry(entryContentJsObj, entryDatabaseIdStr, entryDbUploadDateStr)', function() {
	describe('for a single DBQ VLER SOR Javascript Obj result', function() {
	    it('should return this result transformed into a single JSON atom entry Javascript Object', function() {	
	    	
	    	var dbqJsonDocContentStr = getFileAsStr("./test/dataIn","CapriDbqClaim.json");
	    	var dbqJsonDocContentJsObj = JSON.parse(dbqJsonDocContentStr); 
	    	var docId="4321abcd4321abcd4321abcd";
			var docUploadDate="2012-08-09T16:27:38-05:00";
	    	
	    	var result = feedTransformer.niemDocJsObjToJsonEntry(dbqJsonDocContentJsObj, docId, docUploadDate);
	    	
	    	console.log("result = "+JSON.stringify(result));
	    	
	    	should.exist(result);
	    	should.exist(result.entry);
	    })
	})
});

describe('multiJsonDocJsObjToJsonFeed(multiJsonDocJsObj)', function() {
	describe('for multiple STR VLER SOR Javascript Object results', function() {
	    it('should return these results transformed into a JSON atom feed string', function() {		    	
	    	var strResultsMultiJsonDocStr = getFileAsStr("./test/dataIn","ecrudStrJsonOutput_4items.json");
	    	var strResultsMultiJsonDocJsObj = JSON.parse(strResultsMultiJsonDocStr); 
	    	
	    	var result = feedTransformer.multiJsonDocJsObjToJsonFeed(strResultsMultiJsonDocJsObj);
	    	
	    	should.exist(result);
	    	should.exist(result.feed);
	    	result.feed.author.name.should.equal("Unknown");	    	
	    	should.exist(result.feed.entry);
	    })
	})
});


// TODO: add test method(s) for updateEntryLinksInJsonFeed(feedJsObj) method


describe('getEmptyEntryResponseFeedJsObj(requestUrlStem, altRequestUrlStem)', function() {
	describe('for two value self-link and alternate-link header URLs', function() {
	    it('should return an empty JSON atom entry Javascript Object with the two give URLs as the self-link and alternate-link @href values', function() {		    	
	    	var requestUrlStem = "/myAAValue/myCIDValue/myPath1/myPath2/myPath3?query=Myqueryvalue&cache=true";
	    	var altRequestUrlStem = "/myAltAAValue/myAltCIDValue/myPath1/myPath2/myPath3?query=Myqueryvalue&cache=true";
	    	
	    	var result = feedTransformer.getEmptyEntryResponseFeedJsObj(requestUrlStem, altRequestUrlStem);
	    	
	    	should.exist(result);
	    	should.exist(result.feed);
	    	should.exist(result.feed.title);
	    	should.exist(result.feed.entry);
	    })
	})
});

describe('aggregateFeedsArrToJsObj(finalFeedJsObj, feedJsObjsArr)', function() {
	describe('for the given array of JSON feed strings and the given empty feed Javascript Object', function() {
	    it('should return a JSON atom feed string with the given values aggregated into a single feed into the given empty feed', function() {		    	
	    	var finalFeedJsObj = { 
	    			"feed": {"-xmlns":"http://www.w3.org/2005/Atom","-xsi:schemaLocation":"http://www.w3.org/2005/Atom http://vler.va.gov/vler/schemas/atom/2005/vler/0.2/atom.xsd","-xmlns:xsi":"http://www.w3.org/2001/XMLSchema-instance", "title": {"-type":"text","#text":"My test feed's title"}, 
	    				"entry": {} 
	    			} 
	    	};
	    	var testFeed1JsObj = { 
	    		"feed": {"-xmlns":"http://www.w3.org/2005/Atom","-xsi:schemaLocation":"http://www.w3.org/2005/Atom http://vler.va.gov/vler/schemas/atom/2005/vler/0.2/atom.xsd","-xmlns:xsi":"http://www.w3.org/2001/XMLSchema-instance", "title": {"-type":"text","#text":"My test feed one's title"}, 
	    			"entry": {
				      "title": "Test feed 1 entry 1",
				      "category": { "-term": "Unknown" },
				      "id": "unknown",
				      "published": "unknown",
				      "updated": "unknown",
				      "author": { "name": "Unknown" },
				      "content": {
				        "-type": "*/*",
				        "#text": "Test feed 1 entry 1 content text"
				      },
				      "link": {
				        "-title": "Test feed 1 entry 1 link 1",
				        "-href": "https://localhost/core/fs/000000000000000000000000",
				        "-rel": "enclosure",
				        "-type": "*/*",
				        "-hreflang": "en",
				        "-length": "1000000"
				      }
			    	} 
		    	} 
	    	};
	    	var testFeed2JsObj = { 
	    	"feed": {"-xmlns":"http://www.w3.org/2005/Atom","-xsi:schemaLocation":"http://www.w3.org/2005/Atom http://vler.va.gov/vler/schemas/atom/2005/vler/0.2/atom.xsd","-xmlns:xsi":"http://www.w3.org/2001/XMLSchema-instance", "title": {"-type":"text","#text":"My test feed two's title"}, 
	    		"entry": [{
	    	      "title": "Test feed 2 entry 1",
	    	      "category": { "-term": "Unknown" },
	    	      "id": "unknown",
	    	      "published": "unknown",
	    	      "updated": "unknown",
	    	      "author": { "name": "Unknown" },
	    	      "content": {
	    	        "-type": "*/*",
	    	        "#text": "Test feed 2 entry 1 content text"
	    	      },
	    	      "link": {
	    	        "-title": "Test feed 2 entry 1 link 1",
	    	        "-href": "https://localhost/core/fs/000000000000000000000000",
	    	        "-rel": "enclosure",
	    	        "-type": "*/*",
	    	        "-hreflang": "en",
	    	        "-length": "1000000"
	    	      }
	    	    },
	    	    {"title": "Test feed 2 entry 2",
	    	      "category": { "-term": "Unknown" },
	    	      "id": "unknown",
	    	      "published": "unknown",
	    	      "updated": "unknown",
	    	      "author": { "name": "Unknown" },
	    	      "content": {
	    	        "-type": "*/*",
	    	        "#text": "Test feed 2 entry 2 content text"
	    	      },
	    	      "link": [{
	    	        "-title": "Test feed 2 entry 2 link 1",
	    	        "-href": "https://localhost/core/fs/000000000000000000000000",
	    	        "-rel": "enclosure",
	    	        "-type": "*/*",
	    	        "-hreflang": "en",
	    	        "-length": "1000000"
	    	      },
	    	      {
		    	        "-title": "Test feed 2 entry 2 link 2",
		    	        "-href": "https://localhost/core/fs/000000000000000000000000",
		    	        "-rel": "enclosure",
		    	        "-type": "*/*",
		    	        "-hreflang": "en",
		    	        "-length": "1000000"
		    	      }]
	    	      }]  
	    		} 
	    	};
	    	// array has 3 feed.entry items
	    	var feedJsObjsArr = [testFeed1JsObj,testFeed2JsObj];	    	
	    	
	    	var result = feedTransformer.aggregateFeedsArrToJsObj(finalFeedJsObj, feedJsObjsArr);
	    	
	    	should.exist(result);
	    	should.exist(result.feed);
	    	should.exist(result.feed.entry);
	    	result.feed.entry.length.should.equal(3);
	    })
	})
});

function getFileAsStr(dirname,filename) {
	//e.g. dirname = "./test/dataIn"; 
	var filepath = dirname + '/'+filename;	
	var data = fs.readFileSync(filepath);
	return data.toString();
} 
    
