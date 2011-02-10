var util = require("util");
var fs = require("fs");
var vm = require("vm");

VERSION = "0.9.6";
JSLINT_PATH = __dirname + "/fulljslint.js";

var main = function(args) {
	args = args.slice(2); // ignore Node command and script file
	var opts = parseOptions(args);
	var anon = opts.anon;
	opts = opts.opts;

	var jslint = fs.readFileSync(JSLINT_PATH, "utf-8");

	if(opts.verbose) {
		delete opts.verbose;
		var verbose = true;
	}

	if(opts.help || args.length == 0) {
		var readme = fs.readFileSync(__dirname + "/README", "utf-8");
		exit(args.length > 0, readme);
	} else if(opts.version) {
		var sandbox = {};
		vm.runInNewContext(jslint, sandbox);
		exit(true, "JSLint Reporter v" + VERSION + "\n" +
			"JSLint v" + sandbox.JSLINT.edition);
	} else if(opts.upgrade) {
		getJSLint(function(contents) {
			fs.writeFileSync(JSLINT_PATH, contents)
			exit(true);
		});
		return;
	}

	// The Good Parts
	if(opts.goodparts) {
		delete opts.goodparts;
		var goodparts = ["white", "onevar", "undef", "newcap", "nomen",
			"regexp", "plusplus", "bitwise"];
		goodparts.forEach(function(item, i) {
			opts[item] = opts[item] !== false ? true : false;
		});
	}

	if(verbose) {
		process.stderr.write("JSLint options: " + util.inspect(opts) + "\n");
	}

	var doLint = function(filepath) {
		var src = fs.readFileSync(filepath, "utf-8");
		var sandbox = {
			SRC: src,
			OPTS: opts
		};
		vm.runInNewContext(jslint + "\nJSLINT(SRC, OPTS);", sandbox);
		return sandbox.JSLINT.errors;
	};

	var errors = [];
	var i;
	for(i = 0; i < anon.length; i++) {
		var filepath = anon[i];
		var err = doLint(filepath);
		err = formatOutput(err, filepath);
		errors = errors.concat(err);
	}
	var pass = errors.length == 0;

	if(!pass) {
		util.print(errors.join("\n") + "\n");
		if(verbose) {
			process.stderr.write(errors.length + " errors\n");
		}
	}

	exit(pass);
};

var getJSLint = function(callback) {
	var https = require("https");
	var options = {
		host: "github.com",
		path: "/douglascrockford/JSLint/raw/master/fulljslint.js"
	};
	https.get(options, function(response) {
		if(response.statusCode != 200) {
			exit(false, "failed to retrieve JSLint file");
		}
		response.setEncoding("utf8");
		var body = [];
		response.on("data", function(chunk) {
			body.push(chunk);
		});
		response.on("end", function() {
			body = body.join("");
			callback(body);
		});
	});
};

var formatOutput = function(errors, filepath) {
	var lines = [];
	var i;
	for(i = 0; i < errors.length; i++) {
		var error = errors[i];
		if(error) { // last item might be null (if linting was aborted)
			var line = [filepath, error.line, error.character, error.reason].
				join(":");
			lines.push(line);
		}
	}
	return lines;
};

var parseOptions = function(args) {
	var opts = {};
	var anon = [];
	var i;
	for(i = 0; i < args.length; i++) {
		var arg = args[i];
		if(arg.indexOf("--") == 0) {
			arg = arg.substr(2);
			if(arg.indexOf("=") == -1) {
				opts[arg] = true;
			} else {
				var pair = arg.split("="); // NB: assumes exactly one "="
				name = pair[0];
				value = pair[1];

				// infer value type
				if(value === "false") {
					value = false;
				}
				switch(name) { // XXX: special-casing JSLint-specifics
					case "indent":
					case "maxerr":
					case "maxlen":
						value = parseInt(value, 10);
						break;
					case "predef":
						value = value.split(",");
						break;
					default:
						break;
				}

				opts[name] = value;
			}
		} else {
			anon.push(arg);
		}
	}
	return {
		opts: opts,
		anon: anon
	};
};

var exit = function(status, msg) {
	if(msg) {
		process.stderr.write(msg + "\n");
	}
	process.exit(status ? 0 : 1);
};

main(process.argv);
