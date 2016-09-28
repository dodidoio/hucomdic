#!/usr/bin/env node
const DEFAULTSERVER = "wss://assist.dodido.io";
const fs = require('fs-extra');
const pathLib = require('path');
const server = require('dodido-client');
const colors = require('colors');
const client = require('dodido-client');
var config = null;
var configFile = null;
var rl = null;
var activeRequest = null;
clearActiveRequest();
function clearActiveRequest(){
	activeRequest = {req:null,interact:true};
}
function showSend(text){
	console.log(text.yellow);
}

function showLog(text){
	console.log(text.grey);
}

function showReceive(text){
	console.log(text.cyan);
}

function showError(text){
	console.log(text.red.bold);
}

function saveConfig(){
	fs.writeJSONSync(configFile,config);
}

var commands = {
	add : function(line){
		config.bot.packages = config.bot.packages.concat(line.split(',').map((element)=>element.trim()));
		saveConfig();
	},
	remove : function(line){
		const index = config.bot.packages.indexOf(line);
		if(index === -1){
			showError(`Package '${line}' was not found in the list of packages. Cannot remove it`);
		}else{
			config.bot.packages.splice(index,1);
			saveConfig();
		}
	},
	echo : function(line){
		showReceive(line);
	},
	exit : function(){
		process.exit(0);
	},
	help : function(){
		showReceive('No help yet');
	},
	config : function(){
		showLog(JSON.stringify(config.bot));
	}
};

function main(){
	var args = require('minimist')(process.argv.slice(2),{alias:{help:'h',dir:'d',file:'f'}});
	if(args.help){
		console.info('Usage bot {OPTIONS}');
		console.info('\t--help\tShow this message');
		console.info('\t--dir,-d\tSpecify the directory to upload');
		console.info('\t--new,-n\tStart a new session - erase history from previous session');
		console.info('\t--clear,-c\tStart a new context but don\'t erase other information');
		console.info('after starting the bot, the following commands are available:');
		console.info('\t+{package-name} -  add package {package-name}');
		console.info('\t-{package-name} -  remove package {package-name}');
		console.info('\t.exit - exit the command line');
		console.info('\t.config - show bot configuration object');
		process.exit(0);
	}
	const syncDir = require('path').resolve(args.dir || process.cwd());
	configFile = syncDir + require('path').sep + ".dodido.json";
	try{
		config = fs.readJsonSync(configFile);
	}catch(e){
		console.error(`Could not open Dodido config file "${configFile}". Dodido config file is required to use the bot`.red.bold);
		console.error('working dir is ',process.cwd());
		process.exit(1);
	}
	if(!config.bot || args.new){
		//initialize bot
		config.bot = {packages:[],cid:require('uuid').v4()};
		saveConfig();
	}
	
	if(args.clear){
		//start new context
		config.bot.cid = require('uuid').v4();
		saveConfig();
	}
	
	//connect to server
	client.connect(config.server || DEFAULTSERVER,config.token).then(()=>{
		showLog("Connected to server - write your request and then click <Enter>");
		const readline = require('readline');

		rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});
		rl.prompt();
		rl.on('line',(line)=>{
			if(line.match(/^\+(.*)$/)){
				commands.add(line.match(/^\+(.*)$/)[1]);
				rl.prompt();
			}else if(line.match(/^\.(\w+)\s*(.*)$/)){
				const match = line.match(/^\.(\w+)\s*(.*)$/);
				if(!commands[match[1]]){
					showError('Unknown command');
				}else{
					commands[match[1]](match[2]);
				}
				rl.prompt();
			}else{
				const input = {
					input:line,
					packages : config.bot.packages.join(','),
					expecting:'action'
				};
				const newRequest = client.request(input,config.bot.cid)
					.on('say',(text)=>{
						showReceive(text);
						activeRequest.interact = true;
					}).on('error',(err)=>{
						activeRequest.interact = true;
						showError(err);
					}).on('log',(log)=>{
						showLog(log);
					}).on('fail',()=>{
						activeRequest.interact = true;
						showError('I could not understand your request. Can you please rephrase?');
					}).on('options',(options)=>{
						showReceive('I can interpret your request in several ways:');
						showReceive(JSON.stringify(options));
					}).on('ask',(message,id,description,expecting)=>{
						rl.question(message + "? ",(answer)=>{
							client.answer(id,answer,expecting).on('error',(err)=>{
								showError(err);
							}).on('fail',()=>{
								showError('Could not understand your answer');
							});
						});
					}).then(()=>{
						if(!activeRequest.interact)
							showReceive('Done');
						rl.prompt();
					});
				activeRequest = {req:newRequest,interact:false};
			}
		});

	}).catch((err)=>{
		showError(err);
		process.exit(1);
	});
}
main();