const fs = require('fs-extra');
const jsonYaml = require('json-yaml');
const pathLib = require('path');
const server = require('dodido-client');
const readline = require('readline');
const colors = require('colors');
const normalizeDictionary = require('./normalize-dictionary');
const walk = require('klaw');
const config = require('./config');
var processing = 0;
var errorCount = 0;
var ignoreCount = 0;
var fileCount = 0;
var connected = false;

function connect(url,token){
	return server.connect(url,token);
}

function error(text){
	errorCount++;
	readline.clearLine(process.stdout);
	console.error(text.red.bold);
}

//messages are different from error and log in that they are overwritten by following messages
function message(text){
	readline.clearLine(process.stdout);
	process.stdout.write(text);
	readline.cursorTo(process.stdout, 0);
}
function log(text){
	readline.clearLine(process.stdout);
	console.info(text);
}

function uploadManifest(path){
	const id = pathLib.relative(process.cwd(),path).replace(/\\/g,'/');
	var manifest = null;
	try{
		//manifest = fs.readJsonSync(path);
		manifest = loadFile(path);
	}catch(e){
		error(`Error loading file ${path} - ${e}`);
		return;
	}
	if(!manifest){
		error("Could not open file " + id);
		return;
	}
	processing++;
	fileCount++;
	var errorMessage = null;
	if(path.match(/\.dic$/)){
		//calling normalize-dictionary to show any existing errors
		let hasError = false;
		normalizeDictionary(
			manifest,
			(entry,message)=>{
				if(!errorMessage)
					errorMessage = `dictionary file format error: ${message} in ${JSON.stringify(entry)}`;
			}
		);
	}
	server.saveManifest(id,manifest).on('error',function(err){
		errorMessage = err;
	}).then(()=>{
		if(errorMessage){
			return Promise.reject(errorMessage);
		}
		processing--;
		message("Uploaded file " + id);
		if(processing === 0){
			exit();
		}
	}).catch((err)=>{
		error(`Error uploading file '${id}' - ${err}`);
		processing--;
		if(processing === 0){
			exit();
		}
	});
}

function uploadFile(path){
	const id = pathLib.relative(process.cwd(),path).replace(/\\/g,'/');
	var file = null;
	try{
		file = fs.readFileSync(path);
	}catch(e){
		error(`Error loading file ${path} - ${e}`);
		processing--;
		if(processing === 0){
			exit();
		}
		return;
	}
	if(!file){
		error(`Could not load file ${id}`);
		return;
	}
	processing++;
	fileCount++;
	var errorMessage = null;
	server.saveFile(id,file).on('error',(err)=>{
		errorMessage = err;
	}).then(()=>{
		if(errorMessage){
			return Promise.reject(errorMessage);
		}
		processing--;
		message("Uploaded file " + id);
		if(processing === 0){
			exit();
		}
	}).catch((err)=>{
		error(`Error uploading file '${id}' - ${err}`);
		processing--;
		if(processing === 0){
			exit();
		}
	});
}

function upload(path){
	if(isManifest(path)){
		uploadManifest(path);
	}else{
		if(pathLib.parse(path).base !== '.dodido.json'){//ignore .dodido.json file
			uploadFile(path);
		}
	}
}

function uploadList(files){
	for(var i=0;i<files.length;++i){
		upload(files[i]);
	}
	if(processing === 0){
		exit();
	}
}

function uploadAll(dir,since){
	since = since || 0;
	walk(dir)
		.on('data', (item)=> {
			if(!item.stats.isDirectory() && item.stats.mtime > since){
				upload(item.path);
			}
		}).on('end',function(){
		if(processing === 0){
			exit();
		}
	});
}

function exit(){
	if(errorCount){
		log(`Completed processing ${fileCount} files with ${errorCount} errors`.red.bold);
	}else{
		log(`Completed uploading ${fileCount} files`.green);
	}
	process.exit(0);
}
module.exports = {
	uploadAll : uploadAll,
	uploadList : uploadList,
	connect : connect
};

function loadFile(path){
	try{
		return jsonYaml.readFileSync(path, 'utf-8');
	}catch(e){
		return fs.readJsonSync(path);
	}
}

function isManifest(path){
	const match = path.match(/\.([a-zA-Z0-9\-_]+)$/);
	const ext = match? match[1] : null;
	return config.manifestExtensions.includes(ext);
}
function isFile(path){
	const match = path.match(/\.([a-zA-Z0-9\-_]+)$/);
	const ext = match? match[1] : null;
	return config.fileExtensions.includes(ext);
}