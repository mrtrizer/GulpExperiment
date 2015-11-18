if (process.argv.length < 3)
{
	console.log("Use:\n node server.js <project path>");
	process.exit(1);
}

var gulp = require("gulp");
var browserify = require("browserify");
var babelify = require("babelify");
var source = require("vinyl-source-stream");
var buffer = require("vinyl-buffer");
var rigger = require("gulp-rigger");
var sourcemaps = require("gulp-sourcemaps");
var watchify = require("watchify");
var babel = require('gulp-babel');
var childProcess = require("child_process");
var http = require("http");
var url = require('url');
var path = require('path');
var fs = require('fs');
var reload = require('require-reload')(require);
var clientPath = process.argv[2];
var projectPath = path.resolve(clientPath, "project.json");
var absoluteClientPath = path.resolve(process.cwd, path.dirname(process.argv[1]));

if (!isExists(projectPath))
{
	console.log("Can't find project.json file in " + clientPath);
	process.exit(2);
}

var projectConfig = JSON.parse(fs.readFileSync(projectPath));
console.log(projectConfig);

var handlers = {}; 

var config = {
	"server_http_port":80,
	"engine_path":path.resolve(absoluteClientPath,"engine")
}

console.log("Client dir: " + clientPath);
console.log("Engine dir: " + config.engine_path);

function execGulp(dir,task,name,done)
{
	var gulp = childProcess.spawn("gulp", [task], {cwd:dir});
	function write (data){
		process.stdout.write("[" + name + "] " + data)
	};
	gulp.stdout.on("data",write);
	gulp.stderr.on("data",write);
}

function startHTTP(route,config)
{
	function onRequest(request, response) 
	{
		var pathName = url.parse(request.url).pathname;
		console.log("HTTP Request for " + pathName + " received.");
		route(pathName, request, response);
	}
	http.createServer(onRequest).listen(config.server_http_port);
	console.log("Server HTTP has been started on port: " + config.server_http_port);
}

function isExists(name)
{
	var access = false;
	try {
		fs.accessSync(name,fs.R_OK);
		access = true;
	} 
	catch (e) {}
	return access;
}

function writeError(response, n, msg, httpStatus)
{
	console.log("ERROR #" + n + ": " + msg);
	response.writeHead(httpStatus || 404, {'Content-Type': 'text/plain'});
	response.write(JSON.stringify({error: n, msg: msg}));
	response.end();
}

function fileNotFound(response)
{
	writeError(response, 101, "404 File not found"); 
}

function writeFile(response, fileName)
{
	const mimeTypes = {
		"html": "text/html",
		"jpeg": "image/jpeg",
		"jpg": "image/jpeg",
		"png": "image/png",
		"js": "text/javascript",
		"css": "text/css",
		"mp3": "audio/mpeg mp3"};
	var pathItems = path.extname(fileName).split(".");
	var mimeType = mimeTypes[pathItems[pathItems.length - 1]];
	response.writeHead(200, {'Content-Type': mimeType});
	var fileStream = fs.createReadStream(fileName);
	fileStream.pipe(response);
}

function route(pname, request, response)
{
	var pathName = "";
	if(pname.indexOf("/") != -1)
		pathName = pname.replace(/\/+/,"");
	var isAvaliable = new Boolean(handlers[pathName]);
	console.log("URL: " + pathName + " Direct handler:" + isAvaliable);
	if (isAvaliable == false)
	{
		for (var handlerName in handlers)
		{
			if (handlerName.indexOf("*") != -1)
			{
				var n = 0;
				while((n < pathName.length) && (n < handlerName.length)) {
					if (handlerName[n] == "*")
					{
						var relativePath = pathName.slice(n,pathName.length);
						var fullPath = "";
						if (path.isAbsolute(handlers[handlerName]))
							fullPath = path.resolve(handlers[handlerName],relativePath);
						else
							fullPath = path.resolve(absoluteClientPath,handlers[handlerName],relativePath);
						console.log("File path: " + fullPath);
						if (!isExists(fullPath))
						{
							fileNotFound(response);
							return;
						}
						writeFile(response, fullPath);
						return;
					}
					if (pathName[n] !== handlerName[n])
						break;
					n++;
				} 			
			}
		}
		fileNotFound(response);
		return;
	}
	if (typeof handlers[pathName] === 'function') 
	{
		handlers[pathName](request,response);
		return;
	}
	if (typeof handlers[pathName] === 'string')
	{
		if (!isExists(handlers[pathName])) {
			fileNotFound(response);
			return;
		}

		var fileName = "";
		if (path.isAbsolute(handlers[pathName]))
			fileName = handlers[pathName]; 
		else
			fileName = path.resolve(absoluteClientPath, handlers[pathName]);

		console.log("File path: " + fileName);
		writeFile(response, fileName); 	
	}
}//route

function updateHandlers()
{
	console.log("Handler updating");
	handlers = reload(path.resolve(clientPath, ".bin/server/", path.basename(projectConfig.server))).handlers;	
	handlers["index.html"] = "./engine/bin/index.html";
	handlers["engine.js"] = "./engine/bin/app.js" 
	handlers["app.js"] = path.resolve(clientPath,".bin/client/app.js");
	handlers["app.js.map"] = path.resolve(clientPath,".bin/client/app.js.map");
	handlers["res/*"] = path.resolve(clientPath,".bin/res/");
}

function startServer()
{
	startHTTP(route,config);
}

function buildAll(done)
{
	execGulp(config.engine_path,"watch","engine");
	initGulp(clientPath,projectConfig);
	gulp.start("watch");
	startServer();
}

function initGulp(projectPath,params)
{
	var serverPath = path.resolve(projectPath,path.dirname(params.server),"*.js");
	var serverMainSource = path.resolve(projectPath,params.server);
	var resPath = path.resolve(projectPath,params.res);
	var clientMainSource = path.resolve(projectPath,params.client);
	var commonPath = path.resolve(projectPath,params.common,"*.js");
	var bundler = createAppBundler(clientMainSource,[watchify]);
	
	//Build all
	gulp.task("build",["client:js:build", "server:babel:build", "common:babel:build", "res:build"]);

	//Build client
	gulp.task("client:js:build", ["common:babel:build"], function(done) {
			build(bundler,done,"app.js",path.resolve(projectPath,".bin/client/"));
	});

	//Build res
	gulp.task("res:build", function(done) {
			gulp.src(resPath)
			.pipe(gulp.dest(path.resolve(projectPath,".bin/res/")))
			.on("end",done)
			.on('error',log);
	});

	//Build server
	gulp.task("server:babel:build", function(done) {
			gulp.src(serverPath)
			.pipe(babel({
				presets: ['es2015']
			}))
			.pipe(gulp.dest(path.resolve(projectPath,".bin/server/")))
			.on("end",done)
			.on('error',log);
	});

	//Build common
	gulp.task("common:babel:build", function(done) {
			gulp.src(commonPath)
			.pipe(babel({
				presets: ['es2015']
			}))
			.pipe(gulp.dest(path.resolve(projectPath,".bin/common/")))
			.on("end",done)
			.on('error',log);
			
	});

	gulp.task("update_handlers", ["common:babel:build", "server:babel:build"], function()
	{
		updateHandlers();
	});

	//Watch all
	gulp.task("watch", function(done) {
			//Browserify + Watchify
			
			bundler.on("update", function(){
				gulp.start("client:js:build");
				});
			gulp.start("client:js:build");
			gulp.watch(path.resolve(projectPath,"./src/common/*.js"),["update_handlers"]);
			gulp.watch(path.resolve(projectPath,"./src/server/*.js"),["update_handlers"]);
			gulp.start("update_handlers");
			gulp.watch(path.resolve(projectPath,"./src/res/*"),["res:build"]);
			gulp.start("res:build");
	});
	
	function log(error) {
		console.log("[" + error.name + " in " + error.plugin + "] " + error.message);
		this.emit("end");
	}

	function build(bundler, done, name, dest)
	{
		console.log(dest);
		console.log("JS Building start");
		bundler.bundle()
		.pipe(source(name))
		.pipe(buffer())
		.pipe(sourcemaps.init({ loadMaps: true }))
		.pipe(sourcemaps.write("./",{sourceRoot:"./"}))
		.on('error',log)
		.pipe(gulp.dest(dest))
		.on("end",function(){
				console.log("JS Building finish");
				if (typeof(done) === "function") 
					done()
			} );
	}

	function createAppBundler(source, plugin)
	{
		return browserify(source, { debug: true,  plugin: (plugin || [])})
			.require(source, {expose: "app"})
			.transform(babelify,{presets:["es2015"]})
	}
}

buildAll(startServer);
