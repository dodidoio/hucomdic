#!/usr/bin/env node
const colors = require('colors');
const fs = require('fs-extra');
const DEFAULTSERVER = "wss://assist.dodido.io";
var config = null;
var args = require('minimist')(process.argv.slice(2),{alias:{help:'h',dir:'d',file:'f'}});
if(args.help){
	console.info('Usage hucomdic {OPTIONS}');
	console.info('\t--help\tShow this message');
	console.info('\t--dir,-d\tSpecify the directory to upload');
	console.info('\t--file,-f\tSpecify the directory to upload');
	process.exit(0);
}
const syncDir = require('path').resolve(args.dir || process.cwd());
const configFile = syncDir + require('path').sep + ".dodido.json";
try{
	config = fs.readJsonSync(configFile);
}catch(e){
	console.error(`Could not open Dodido config file "${configFile}". Exiting without uploading`.red.bold);
	console.error('working dir is ',process.cwd());
	process.exit(1);
}
require('.').connect(config.server || DEFAULTSERVER,config.token).then(()=>{
	if(args.file && !Array.isArray(args.file)){
		//make sur args.file is an array
		args.file = [args.file];
	}
	if(args.file){
		require('.').uploadList(args.file);
	}else{
		require('.').uploadAll(syncDir);
	}
}).catch((err)=>{
	error("An error occured while uploading files - " + err);
	exit(-1);
});