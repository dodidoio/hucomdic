const fs = require('fs-extra');
const pathLib = require('path');
const server = require('dodido-client');
const colors = require('colors');
var processing = 0;
var lastMessageLength = 0;
var errorCount = 0;
var ignoreCount = 0;
var fileCount = 0;
var connected = false;

function connect(url,token){
	return server.connect(url,token);
}

function error(text){
	errorCount++;
	console.error(text.red.bold);
}

function log(text){
	var spaces = "";
	for(var i=0;i<lastMessageLength;++i){
		spaces += ' ';
	}
	process.stdout.write(spaces + '\r');
	lastMessageLength = text.length;
	process.stdout.write(text + '\r');
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
	server.saveManifest(id,manifest).on('error',function(err){
		error(`Error uploading manifest ${id} - ${err}`);
		processing--;
		if(processing === 0){
			exit();
		}
	}).then(()=>{
		processing--;
		fileCount++;
		log("Uploaded manifest " + id);
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
		return;
	}
	if(!file){
		error(`Could not load file ${id}`);
		return;
	}
	processing++;
	server.saveFile(id,file).on('error',(err)=>{
		error(`Error uploading file ${id} - ${err}`);
		processing--;
		if(processing === 0){
			exit();
		}
	}).then(()=>{
		processing--;
		fileCount++;
		log("Uploaded file " + id);
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
	fs.walk(dir)
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
		log(`Completed uploading ${fileCount} files with ${errorCount} errors`.red.bold);
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