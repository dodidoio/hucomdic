#!/usr/bin/env node

const colors = require('colors');
const fs = require('fs-extra');
const server = require('dodido-client');

const DEFAULTSERVER = "wss://assist.dodido.io";
var config = null;
var args = require('minimist')(process.argv.slice(2),{alias:{help:'h',dir:'d',file:'f',init:'i',server:'s',all:'a'}});

if(args.help){
	console.info('Usage: $hucomdic {OPTIONS}');
	console.info('\t--help\tShow this message');
	console.info('\t--dir,-d\tSpecify the directory to upload');
	console.info('\t--init,-i\tInitialize a new environment');
	console.info('\t--file,-f\tSpecify the directory to upload');
	console.info("First time use: call '$hucomdic init' to initialize the environment for use with the human-computer dictionary");
	console.info('\t--file,-f\tSpecify the file to upload');
	console.info('\t--all,-a\tUpload all files - default is upload only files changed since last upload');
	process.exit(0);
}

const syncDir = require('path').resolve(args.dir || process.cwd());
process.chdir(syncDir);
const configFile = ".dodido.json";

if(args._[0] === 'init'){
	init();
}else{
	connect();
}

function connect(){
	try{
		config = fs.readJsonSync(configFile);
	}catch(e){
		console.error(`Could not open Dodido config file "${configFile}". Use 'hucomdic init' to prepare the environment for work with the human computer dictionary.`.red.bold);
		console.error('working dir is ',process.cwd());
		process.exit(1);
	}
	if(!config.token){
		console.error("There is an error in the .dodido.json config file. Use 'hucomdic init' to recreate the config file".red.bold);
		process.exit(1);
	}
	server.connect(args.server||config.server || DEFAULTSERVER,config.token).then(upload);
}

function init(){
	console.info("Welcome to the human-computer dictionary. We are initializing the working dir for upload to the human-computer dictionary. A configuration file named .dodido.json will be added to the working dir.");
		
	const rl =  require('readline').createInterface({
		input: process.stdin,
		output: process.stdout
	});
	var username,pswd;
	rl.question("What is your username? ",(answer)=>{
		username = answer;
		rl.question("What is your password? ",(answer)=>{
			pswd = answer;
			server.connect(args.server||DEFAULTSERVER).then(()=>{
				return server.signin(username,pswd).on('token',(token)=>{
					config = {server:args.server||DEFAULTSERVER,token:token,userid:username};
					fs.writeJSONSync(configFile,config);
				}).on('error',(err)=>{
					console.error(`Error singing in to server - ${err}`.red.bold);
					process.exit(1);
				});
			}).then(connect).catch((err)=>{
				console.error(`There was an error connecting to the server or initializing the environment - ${err}.`.red.bold);
				process.exit(1);
			});
	});

	});
}

function upload(){
	if(args.file && !Array.isArray(args.file)){
		//make sur args.file is an array
		args.file = [args.file];
	}
	try{
		if(args.file){
			require('.').uploadList(args.file);
		}else{
			//write last update date
			since = config.lastUpdate || 0;
			if(args.all){
				//upload all files - set since to 0
				since = 0;
			}
			config.lastUpdate = Date.now();
			fs.writeJSONSync(configFile,config);
			require('.').uploadAll(syncDir,since);
		}
	}catch(err){
		console.error("An error occured while uploading files - " + err);
		process.exit(-1);
	}
}