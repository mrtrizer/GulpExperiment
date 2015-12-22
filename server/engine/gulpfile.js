var gulp = require("gulp");
var browserify = require("browserify");
var babelify = require("babelify");
var source = require("vinyl-source-stream");
var buffer = require("vinyl-buffer");
var rigger = require("gulp-rigger");
var sourcemaps = require("gulp-sourcemaps");
var watchify = require("watchify");
var batch = require("gulp-batch");

function log(error) {
	    console.log("[" + error.name + " in " + error.plugin + "] " + error.message);
	    this.emit("end");
}

function build(bundler, done)
{
	console.log("JS Building start");
	bundler.bundle()
	.pipe(source('app.js'))
	.pipe(buffer())
	.pipe(sourcemaps.init({ loadMaps: true }))
	.pipe(sourcemaps.write("./",{sourceRoot:"./"}))
	.on('error',log)
	.pipe(gulp.dest("./bin/"))
	.on("end",function(){
			console.log("JS Building finish");
			if (typeof(done) === "function") 
				done()
		} );
}

function createBundler(plugin)
{
	return browserify('./src/engine.js', {plugin: (plugin || [])})
		.transform(babelify,{presets:["es2015"]})
		.require("./src/engine.js", {expose: "engine"})
}

//Build all
gulp.task("build",["js:build", "html:build"]);

//Build JS
gulp.task("js:build", function(done) {
		build(createBundler(),done);
});

//Build HTML
gulp.task("html:build", function(done) {
	gulp.src("./src/*.html")
	.pipe(gulp.dest("./bin/"))
	.on("end",done);
});

//Watch all
gulp.task("watch", function(done) {
		//Browserify + Watchify
		var bundler = createBundler([watchify]);
		bundler.on("update", function(){ build(bundler)});
		build(bundler,done);
		//HTML
		gulp.watch("./src/*.html", ["html:build"]);
		gulp.start("html:build");
});

