const fs = require('fs-extra');
const pathLib = require('path');
const server = require('dodido-client');
const readline = require('readline');
const colors = require('colors');
const normalizeDictionary = require('./normalize-dictionary');
const walk = require('klaw');

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
	console.log(text);
}

function uploadManifest(path){
	const id = pathLib.relative(process.cwd(),path).replace(/\\/g,'/');
	var manifest = null;
	try{
		manifest = fs.readJsonSync(path);
	}catch(e){
		error(`Error loading file ${path} - ${e}`);
		return;
	}
	if(!manifest){
		error("Could not open manifest " + id);
		return;
	}
	processing++;
	fileCount++;
	var errorMessage = null;
	if(path.match(/\.dic$/)){
		manifest = normalizeDictionary(manifest);
	}
	server.saveManifest(id,manifest).on('error',function(err){
		errorMessage = err;
	}).then(()=>{
		if(errorMessage){
			return Promise.reject(errorMessage);
		}
		processing--;
		message("Uploaded manifest " + id);
		if(processing === 0){
			exit();
		}
	}).catch((err)=>{
		error(`Error uploading manifest ${id} - ${err}`);
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
		error(`Error uploading file ${id} - ${err}`);
		processing--;
		if(processing === 0){
			exit();
		}
	});
}

function upload(path){
	const match = path.match(/\.([a-zA-Z0-9\-_]+)$/);
	const ext = match? match[1] : null;
	switch(ext){
		case 'dic':
		case 'bot':
		case 'hook':
			uploadManifest(path);
			break;
		case 'js':
		case 'json':
			if(pathLib.parse(path).base !== '.dodido.json'){//ignore .dodido.json file
				uploadFile(path);
			}
			break;
		default:
			ignoreCount++;
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