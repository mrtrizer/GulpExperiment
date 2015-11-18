var gulp = require("gulp");
var browserify = require("browserify");
var babelify = require("babelify");
var source = require("vinyl-source-stream");
var buffer = require("vinyl-buffer");
var rigger = require("gulp-rigger");
var sourcemaps = require("gulp-sourcemaps");
var watchify = require("watchify");
var batch = require("gulp-batch");
var babel = require('gulp-babel');

function log(error) {
	    console.log("[" + error.name + " in " + error.plugin + "] " + error.message);
	    this.emit("end");
}

function build(bundler,done)
{
	bundler.bundle()
	.pipe(source('app.js'))
	.pipe(buffer())
	.pipe(sourcemaps.init({ loadMaps: true }))
	.pipe(sourcemaps.write("./",{sourceRoot:"./"}))
	.on('error',log)
	.pipe(gulp.dest("./bin/client"))
	.on("end",done);
}

function createBundler()
{
	return browserify('./client/test.js', { debug: true })
		.require("./client/test.js", {expose: "app"})
		.transform(babelify,{presets:["es2015"]})
}

//Build all
gulp.task("build",["js:build", "html:build","server:babel:build","common:babel:build"]);

//Build JS
gulp.task("js:build", function(done) {
		build(createBundler(),done);
});

//Build server
gulp.task("server:babel:build", function(done) {
		gulp.src("./server/handlers.js")
		.pipe(babel({
            presets: ['es2015']
        }))
		.pipe(gulp.dest("./bin/server/"))
		.on("end",done);
});

gulp.task("common:babel:build", function(done) {
		gulp.src("./common/common.js")
		.pipe(babel({
            presets: ['es2015']
        }))
		.pipe(gulp.dest("./bin/common/"))
		.on("end",done);
});

//Build HTML
gulp.task("html:build", function(done) {
	gulp.src("./src/*.html")
	.pipe(gulp.dest("./bin/"))
	.on("end",done);
});

//Watch all
gulp.task("watch", function() {
		//Browserify + Watchify
		var watch = watchify(createBundler());
		watch.on("update", function(){ gulp.start("js:build");});
		//HTML
		gulp.watch("./src/*.html", ["html:build"]);
		//Build on start
		gulp.start("build");
});

