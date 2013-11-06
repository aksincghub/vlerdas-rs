var express = require('express');
var moment = require('moment');
var request = require("request");
var config = require('config');
// export config, so that it can be used anywhere, i.e. in child .js modules
module.exports.config = config;
var Log = require('vcommons').log;
var logger = Log.getLogger('VRS', config.log);
module.exports.logger = logger;
var _ = require('underscore');
var fs = require("fs");
var http = require('http');
var https = require('https');
var Router = require('../lib/router');
var url = require('url');

	
var router = new Router();

var app = express();

app.configure(function () {
	 var mountPoint = config.context;	
	// enable web server logging; pipe those log messages through winston
	var winstonStream = {
		write: function(message, encoding){
			logger.trace(message);
		}
	};
	// 
	app.use(mountPoint, express.methodOverride());
	// use default bodyParser - bodyParser parses the body and sets req.body
    app.use(mountPoint, express.bodyParser());	  
	// set Simple Access Control - TODO: Preferences & Authorizations
    if (config.accessControl) {
    	var accessControl = require('vcommons').accessControl;
    	app.use(mountPoint, accessControl());
    }    
    // set log
    app.use(express.logger({stream: winstonStream}));
    //  set the default express router to handle the app.get() calls below
    app.use(mountPoint, app.router);
	// set debug errorHandler only for development
	if(config.debug) {
		app.use(express.errorHandler({ showStack: true, dumpExceptions: true }));
	}
	// log errors and send response for errors thrown
	app.use(function(err, req, res, next) {
		  logger.error(err.stack);
		  logger.error('error thrown in for '+req.url+' request!, returning 500 response....');		  
		  var body = "HTTP/1.1 500 INTERNAL SERVER ERROR";	
		  res.setHeader('Content-Length', body.length);
		  // must set content-type for REST response
		  res.contentType('text/plain');
		  res.charset = 'utf-8'; 
		  res.send(500, body);
		  next(err);
		});
});

app.get('/', router.sendUnsupportedResponse);

app.get('/:aa', router.sendUnsupportedResponse);

app.get('/:aa/:cid', router.sendUnsupportedResponse);

app.get('/:aa/:cid/:path1', function(req, res, next) {
	  logger.trace('received a request for: '+req.url+' ... with headers: ',req.headers);  
	  res.locals.statusCode = 200;	  
	  // determine if request is supported, request type, and routing instructions, 
	  // then place items into request scope for response processing 
	  // try to match first-pass collection path to get its "route definition" from config
	  var routeDef = get1PRouteDef(config.resources.path1, '/'+req.params.path1);
	  if(routeDef != null) {	 
		  // store first-pass items in request scope 	 
		  res.locals.reqType = '1P';
		  res.locals.fileId = '';
		  res.locals.routeDef = routeDef;	  
	  }  else {	
		  // try to match second-pass collection path to get its "route definition" from config
		  routeDef = get2PRouteDef(config.resources.path1, '/');	  
		  if(routeDef != null) { 
			// store second-pass items in request scope 
			res.locals.reqType = '2P';
			res.locals.fileId = req.params.path1;
			res.locals.routeDef = routeDef;		
		  }
	  }  
	  // if still no routeDef found, then no 1P or 2P cpath matches request, so...
	  if(routeDef == null) {	  
		  // store unsupported items in request scope    
		  res.locals.reqType = 'Unsupported';	  
	  } 
	  // store the rest of the items in request scope
	  res.locals.pathLevel = 'path1';
	  res.locals.aa = req.params.aa;
	  res.locals.cid = req.params.cid;  
	  // NOTE: req.query = {"personSSN":"123456789","myVariable":"hello"}
	  res.locals.queryParams = req.query;
	  // add query params as string, not including the '?'
	  var queryStr = url.parse(req.url).query;
	  res.locals.queryStr = queryStr; 
	  // pass on
	  next();	  
	}, router.processServices, router.process1PResponse, router.process2PResponse, router.sendUnsupportedResponse, router.sendSupportedResponse);

app.get('/:aa/:cid/:path1/:path2', function(req, res, next) {
	  logger.trace('received a request for: '+req.url+' ... with headers: ',req.headers);  
	  res.locals.statusCode = 200;
	  // determine if request is supported, request type, and routing instructions, 
	  // then place items into request scope for response processing 
	  // try to match first-pass collection path to get its "route definition" from config
	  var routeDef = get1PRouteDef(config.resources.path2, '/'+req.params.path1+'/'+req.params.path2);
	  if(routeDef != null) {	 
		  // store first-pass items in request scope 	 
		  res.locals.reqType = '1P';
		  res.locals.fileId = '';
		  res.locals.routeDef = routeDef;	  
	  } else {	
		  // try to match second-pass collection path to get its "route definition" from config
		  routeDef = get2PRouteDef(config.resources.path2, '/'+req.params.path1);	  
		  if(routeDef != null) { 
			// store second-pass items in request scope 
			res.locals.reqType = '2P';
			res.locals.fileId = req.params.path2;
			res.locals.routeDef = routeDef;		
		  }
	  }  
	  // if still no routeDef found, then no 1P or 2P cpath matches request, so...
	  if(routeDef == null) {	  
		  // store unsupported items in request scope 	   
		  res.locals.reqType = 'Unsupported';	  
	  } 
	  // store the rest of the items in request scope
	  res.locals.pathLevel = 'path2';
	  res.locals.aa = req.params.aa;
	  res.locals.cid = req.params.cid;  
	  // NOTE: req.query = {"personSSN":"123456789","myVariable":"hello"}
	  res.locals.queryParams = req.query;
	  // add query params as string, not including the '?'
	  var queryStr = url.parse(req.url).query;
	  res.locals.queryStr = queryStr;
	  // pass on
	  next();	  
	}, router.processServices, router.process1PResponse, router.process2PResponse, router.sendUnsupportedResponse, router.sendSupportedResponse);

app.get('/:aa/:cid/:path1/:path2/:path3', function(req, res, next) {
	  logger.trace('received a request for: '+req.url+' ... with headers: ',req.headers); 
	  res.locals.statusCode = 200;
	  // determine if request is supported, request type, and routing instructions, 
	  // then place items into request scope for response processing 
	  // try to match first-pass collection path to get its "route definition" from config
	  var routeDef = get1PRouteDef(config.resources.path3, '/'+req.params.path1+'/'+req.params.path2+'/'+req.params.path3);
	  if(routeDef != null) {	 
		  // store first-pass items in request scope 	 
		  res.locals.reqType = '1P';
		  res.locals.fileId = '';
		  res.locals.routeDef = routeDef;	  
	  } else {	
		  // try to match second-pass collection path to get its "route definition" from config
		  routeDef = get2PRouteDef(config.resources.path3, '/'+req.params.path1+'/'+req.params.path2);	  
		  if(routeDef != null) { 
			// store second-pass items in request scope 
			res.locals.reqType = '2P';
			res.locals.fileId = req.params.path3;
			res.locals.routeDef = routeDef;		
		  }
	  }  
	  // if still no routeDef found, then no 1P or 2P cpath matches request, so...
	  if(routeDef == null) {	  
		  // store unsupported items in request scope   
		  res.locals.reqType = 'Unsupported';	  
	  } 
	  // store the rest of the items in request scope
	  res.locals.pathLevel = 'path3';
	  res.locals.aa = req.params.aa;
	  res.locals.cid = req.params.cid;  
	  // NOTE: req.query = {"personSSN":"123456789","myVariable":"hello"}
	  res.locals.queryParams = req.query;
	  // add query params as string, not including the '?'
	  var queryStr = url.parse(req.url).query;
	  res.locals.queryStr = queryStr;
	  // pass on
	  next();	  
	}, router.processServices, router.process1PResponse, router.process2PResponse, router.sendUnsupportedResponse, router.sendSupportedResponse);

app.get('/:aa/:cid/:path1/:path2/:path3/:path4', function(req, res, next) {
	  logger.trace('received a request for: '+req.url+' ... with headers: ',req.headers);  
	  res.locals.statusCode = 200;
	  // determine if request is supported, request type, and routing instructions, 
	  // then place items into request scope for response processing 
	  // try to match first-pass collection path to get its "route definition" from config
	  var routeDef = get1PRouteDef(config.resources.path4, '/'+req.params.path1+'/'+req.params.path2+'/'+req.params.path3+'/'+req.params.path4);
	  if(routeDef != null) {	 
		  // store first-pass items in request scope 	 
		  res.locals.reqType = '1P';
		  res.locals.fileId = '';
		  res.locals.routeDef = routeDef;	  
	  } else {	
		  // try to match second-pass collection path to get its "route definition" from config
		  routeDef = get2PRouteDef(config.resources.path4, '/'+req.params.path1+'/'+req.params.path2+'/'+req.params.path3);	  
		  if(routeDef != null) { 
			// store second-pass items in request scope 
			res.locals.reqType = '2P';
			res.locals.fileId = req.params.path4;
			res.locals.routeDef = routeDef;		
		  }
	  }  
	  // if still no routeDef found, then no 1P or 2P cpath matches request, so...
	  if(routeDef == null) {	  
		  // store unsupported items in request scope    
		  res.locals.reqType = 'Unsupported';	  
	  } 
	  // store the rest of the items in request scope
	  res.locals.pathLevel = 'path4';
	  res.locals.aa = req.params.aa;
	  res.locals.cid = req.params.cid;  
	  // NOTE: req.query = {"personSSN":"123456789","myVariable":"hello"}
	  res.locals.queryParams = req.query;
	  // add query params as string, not including the '?'
	  var queryStr = url.parse(req.url).query;
	  res.locals.queryStr = queryStr;
	  // pass on
	  next();	  
	}, router.processServices, router.process1PResponse, router.process2PResponse, router.sendUnsupportedResponse, router.sendSupportedResponse);

app.get('/:aa/:cid/:path1/:path2/:path3/:path4/:path5', function(req, res, next) {
  logger.trace('received a request for: '+req.url+' ... with headers: ',req.headers); 
  res.locals.statusCode = 200;
  // determine if request is supported, request type, and routing instructions, 
  // then place items into request scope for response processing 
  // try to match first-pass collection path to get its "route definition" from config
  var routeDef = get1PRouteDef(config.resources.path5, '/'+req.params.path1+'/'+req.params.path2+'/'+req.params.path3+'/'+req.params.path4+'/'+req.params.path5);
  if(routeDef != null) {	 
	  // store first-pass items in request scope 	 
	  res.locals.reqType = '1P';
	  res.locals.fileId = '';
	  res.locals.routeDef = routeDef;	  
  } else {	
	  // try to match second-pass collection path to get its "route definition" from config
	  routeDef = get2PRouteDef(config.resources.path5, '/'+req.params.path1+'/'+req.params.path2+'/'+req.params.path3+'/'+req.params.path4);	  
	  if(routeDef != null) { 
		// store second-pass items in request scope 
		res.locals.reqType = '2P';
		res.locals.fileId = req.params.path5;
		res.locals.routeDef = routeDef;		
	  }
  }  
  // if still no routeDef found, then no 1P or 2P cpath matches request, so...
  if(routeDef == null) {	  
	  // store unsupported items in request scope   
	  res.locals.reqType = 'Unsupported';	  
  } 
  // store the rest of the items in request scope
  res.locals.pathLevel = 'path5';
  res.locals.aa = req.params.aa;
  res.locals.cid = req.params.cid;  
  // NOTE: req.query = {"personSSN":"123456789","myVariable":"hello"}
  res.locals.queryParams = req.query;
  // add query params as string, not including the '?'
  var queryStr = url.parse(req.url).query;
  res.locals.queryStr = queryStr;
    
  next();	  
}, router.processServices, router.process1PResponse, router.process2PResponse, router.sendUnsupportedResponse, router.sendSupportedResponse);

app.get('/:aa/:pid/:path1/:path2/:path3/:path4/:path5/:path6', function(req, res, next) {
	  logger.trace('received a request for: '+req.url+' ... with headers: ',req.headers);
	  res.locals.statusCode = 200;
	  // determine if request is supported, request type, and routing instructions, 
	  // then place items into request scope for response processing 
	  // try to match first-pass collection path to get its "route definition" from config
	  var routeDef = get1PRouteDef(config.resources.path6, '/'+req.params.path1+'/'+req.params.path2+'/'+req.params.path3+'/'+req.params.path4+'/'+req.params.path5+'/'+req.params.path6);
	  if(routeDef != null) {	 
		  // store first-pass items in request scope 	 
		  res.locals.reqType = '1P';
		  res.locals.fileId = '';
		  res.locals.routeDef = routeDef;	  
	  } else {	
		  // try to match second-pass collection path to get its "route definition" from config
		  routeDef = get2PRouteDef(config.resources.path6, '/'+req.params.path1+'/'+req.params.path2+'/'+req.params.path3+'/'+req.params.path4+'/'+req.params.path5);	  
		  if(routeDef != null) { 
			// store second-pass items in request scope 
			res.locals.reqType = '2P';
			res.locals.fileId = req.params.path6;
			res.locals.routeDef = routeDef;		
		  }
	  }  
	  // if still no routeDef found, then no 1P or 2P cpath matches request, so...
	  if(routeDef == null) {	  
		  // store unsupported items in request scope   
		  res.locals.reqType = 'Unsupported';	  
	  } 
	  // store the rest of the items in request scope
	  res.locals.pathLevel = 'path6';
	  res.locals.aa = req.params.aa;
	  res.locals.cid = req.params.cid;  
	  // NOTE: req.query = {"personSSN":"123456789","myVariable":"hello"}
	  res.locals.queryParams = req.query;
	  // add query params as string, not including the '?'
	  var queryStr = url.parse(req.url).query;
	  res.locals.queryStr = queryStr;
	  // pass on
	  next();	  
	}, router.processServices, router.process1PResponse, router.process2PResponse, router.sendUnsupportedResponse, router.sendSupportedResponse);

function get1PRouteDef(curPathDefJsObj, req1PCpath) {
	  var routeDef;
	  var entry;
	  // is this a first-pass request?
	  var fpArr = curPathDefJsObj.firstPass;
	  var index = 0;
	  for (index = 0; index < fpArr.length; ++index) {
	      entry = fpArr[index];      
	      if (entry.cpath == req1PCpath) {
	    	  routeDef = entry;
	    	  logger.trace('Received 1P request\'s cpath in request which matched: '+entry.cpath);
	          break;
	      }
	  } 
	  return routeDef;
}

function get2PRouteDef(curPathDefJsObj, req2PCpath) {
	  var routeDef;
	  var entry;
	  // is this a second-pass request?
	  var spArr = curPathDefJsObj.secondPass;
	  var index = 0;
	  for (index = 0; index < spArr.length; ++index) {
	      entry = spArr[index];      
	      if (entry.cpath == req2PCpath) {
	    	  routeDef = entry;
	    	  logger.trace('Received 2P request\'s cpath in request which matched: '+entry.cpath);
	          break;
	      } 
	  }	  
	  return routeDef;
}

// listen for requests
if (!_.isUndefined(config.server) || !_.isUndefined(config.secureServer)) {
	if (!_.isUndefined(config.server)) {
		var server = http.createServer(app).listen(config.server.port, config.server.host, function() {
			logger.info('initialized, listening at http://' + config.server.host + ':' + config.server.port + config.context);
		});
	}
	if (!_.isUndefined(config.secureServer)) {
		var httpsServer = https.createServer(fixSSLOptions(config.secureServer.options), app).listen(config.secureServer.port, config.secureServer.host, function() {
			logger.info('initialized, listening at https://' + config.secureServer.host + ':' + config.secureServer.port + config.context);
		});
	}
} else {
	logger.error('Configuration must contain at least a \'server\' or \'secureServer\' entry!');
	process.exit(1);
}

function fixSSLOptions(configOptions)
{
	var options = {};

	if (!_.isUndefined(configOptions.key) && _.isString(configOptions.key)) {
		options.key = fs.readFileSync(configOptions.key);
	}

	if (!_.isUndefined(configOptions.cert) && _.isString(configOptions.cert)) {
		options.cert = fs.readFileSync(configOptions.cert);
	}

	if (!_.isUndefined(configOptions.pfx) && _.isString(configOptions.pfx)) {
		options.pfx = fs.readFileSync(configOptions.pfx);
	}

	return options;
}

// default exception handler
process.on('uncaughtException', function (err) {
    logger.error('caught unhandled exception: \n' + err.stack);
    process.exit(1);
});

// shutdown
process.on( 'SIGINT', function() {
  logger.info('\nShutting down from  SIGINT (Crtl-C)');
  process.exit()
});

// default exception handler
process.on('exit', function (err) {	
	if(err) {
		logger.error('err on exit: \n' + err.stack);
	} else {
		logger.info('exiting....');
	}
});

