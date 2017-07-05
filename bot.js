#!/usr/bin/env node
const DEFAULTSERVER = "wss://assist.dodido.io";
const fs = require('fs-extra');
const pathLib = require('path');
const server = require('dodido-client');
const colors = require('colors');
const client = require('dodido-client');
const show = require('./show');
const context = {};//the context to pass to all requests - it contains token and userid
const crypto = require('crypto');
const textExpand = require('./text-expand');
var config = null;
var configFile = null;
var rl = null;
var activeRequest = null;
var lastQuestion = null;
clearActiveRequest();

/**
 * Clear the active request
 */
function clearActiveRequest(){
	activeRequest = {req:null,interact:true};
}

function showSend(text){
	show(text,'send');
}

function showLog(text){
	show(text,'log');
}

function showReceive(text){
	show(text,'receive');
}

function showError(text){
	show(text,'error');
}

/**
 * Save config file (.dodido.json)
 */
function saveConfig(){
	fs.writeJSONSync(configFile,config);
}

//list of dot command
var commands = {
	add : function(line){
		//add a package to the list of packages the bot recognizes
		config.bot.packages = config.bot.packages.concat(line.split(',').map((element)=>element.trim()));
		saveConfig();
	},
	remove : function(line){
		//remove a package from the list of packages
		const index = config.bot.packages.indexOf(line);
		if(index === -1){
			showError(`Package '${line}' was not found in the list of packages. Cannot remove it`);
		}else{
			config.bot.packages.splice(index,1);
			saveConfig();
		}
	},
	echo : function(line){
		//just echo back some text - for debug
		showReceive(line);
	},
	exit : function(){
		//exit the bot application
		process.exit(0);
	},
	clear : function(){
		//clear the context - just generate a new cid randomly
		config.bot.cid = require('uuid').v4();
		saveConfig();
	},
	help : function(){
		//show help text
		showCommandLineHelp();
	},
	config : function(){
		//show config file
		showLog(JSON.stringify(config.bot));
	},
	call : function(text){
		//call a dictionary javascript function
		processText(text,'call');
	},
	context : function(){
		//show active context by calling the dumpContext function
		processText('dumpContext@dodido/interact','call');
	},
	key : function(text){
		let split = text.match(/^(\S*)\s+(.*)$/);
		if(!split){
			showError('The format of the key directive is: .key {key name} {key value}');
			return;
		}
		if(!config.bot.keys || typeof config.bot.keys !== 'object'){
			config.bot.keys = {};
			context.keys = config.bot.keys;
		}
		config.bot.keys[split[1]] = split[2];
		saveConfig();
		
	},
	whoami : function(){
		//show the name of the user
		client.whoami().on('error',(err)=>{
			showError(err);
		}).on('userid',(userid)=>{
			showReceive(userid);
		});
	}
};

function showCommandLineHelp(){
	console.info('The following command are available from the bot command line:');
	console.info('    +{package-name} -  add package {package-name}');
	console.info('    .remove{package-name} -  remove package {package-name}');
	console.info('    .exit - exit the command line');
	console.info('    .context - show the execution context. This action only shows context entities that are stored on the server - not those that are passed by the bot');
	console.info('    .clear - clear the active context');
	console.info('    .call {function} - call a function within a package - function is written in the format "functionName@owner/package bindingArguments?" as used in the bind property of dictionary entries');
	console.info('    .config - show bot configuration object');
	console.info('    .whoami - show user name');
	console.info('    .key {key name} {key value} - add a key to the context keys');
}

/**
 * Process text. The processing depends on the type. The default type is 'request' - send a request to dodido server.
 * For call, the function treats the input as function binding and calls that function.
 * @param {string} text processed text
 * @param {string} type  one of 'request','call','parsed'
 */
function processText(text,type){
	let isParsed = false;
	let input;
	switch(type){
		case 'parsed':
			//don't need to pass the request though the NLP engine - the text is in the format the server recognizes
			input = text;
			isParsed = true;
			break;
		case 'call':
			//call a specific function from the dictionary modules.
			input = `call(${text})`;
			isParsed = true;
			break;
		default:
			text = textExpand.get(text) || text;
			textExpand.reset();
			if(lastQuestion){
				//we are waiting for an answer
				//if expecting is an array then get the answer with the relevant number
				let answer = text;
				if(lastQuestion.options && !Number.isNaN(parseInt(text)) && parseInt(text) <=lastQuestion.expecting.length && parseInt(text) > 0){
					answer = lastQuestion.options[parseInt(text)-1];
				}
				//if expecting a file then get the file
				if(lastQuestion.expecting === 'file'){
					let content = readFileSyncSafe(answer,{encoding:'utf8'});
					if(!content){
						showError('Could not load the file "'+answer+'". Try again.');
						return;
					}
					answer = {
						filename:require('path').basename(text),
						data:Buffer.from(content).toString('base64')
					};
				}
				//after getting an answer, send the answer to the server with question id and expected type
				client.answer(lastQuestion.id,{
					input:answer,
					expecting: lastQuestion.expecting,
					packages: config.bot.packages.join(','),
					user : config.bot.user,
					userid:context.userid,
				},lastQuestion.expecting,context).on('error',(err)=>{
					showError(err);
				}).on('fail',()=>{
					//handle event where server could not understand the user request
					showError('Could not understand your answer');
				});
				lastQuestion = null;//question already answered
				return;
			}
			input = {
				input : text, //request text
				packages : config.bot.packages.join(','),//list of packages defined in the config file
				expecting : 'action',//user request is always of type 'action'
				token : context.token,//token of the account data is stored in
				userid : context.userid//userid of the request sender. A single token owner may manage many userids
			};
	}
	//create a request
	const newRequest = client.request(input,config.bot.cid,isParsed,context);
		newRequest.on('say',(text)=>{
			//handle say event
			showReceive(text);
			activeRequest.interact = true;
		});
		newRequest.on('config',(name,value,encrypt)=>{
			if(!config.bot.user.configuration){
				config.bot.user.configuration = [];
			}
			if(!config.bot.user.secret){
				config.bot.user.secret = crypto.randomBytes(256).toString('base64');
			}
			let configuration = config.bot.user.configuration;
			
			//search for the required configuration
			for(let i=0;i<configuration.length;++i){
				if(configuration[i].name === name){
					configuration[i].value = value;
					saveConfig();
					return;
				}
			}
			configuration.push({name:name,value:value});
			saveConfig();
		});
	newRequest.on('error',(friendly,techie)=>{
			//handle error event
			activeRequest.interact = true;
			showError(friendly);
			if(techie)
				showLog(techie);
		});
	newRequest.on('log',(log)=>{
			showLog(log);
		});
	newRequest.on('show',(obj,type)=>{
			show(obj,type,config.bot);
		});
	newRequest.on('fail',()=>{
			//fail event is called when server cannot interpret the user request
			activeRequest.interact = true;
			showError('I could not understand your request. Can you please rephrase?');
		});
	newRequest.on('ask',(message,id,description,expecting)=>{
			//ask the user a question
			lastQuestion = {
				message:message,
				options:Array.isArray(expecting)?expecting:null,
				expecting:Array.isArray(expecting)?'text':expecting,
				id:id
			};
			show(lastQuestion,'question',config.bot);
		});
	newRequest.then(()=>{
			if(!activeRequest.interact)
				//if bot did not send any text to the user, print out 'done' so the user knows the action was handled
				showReceive('Done');
			rl.prompt();
		});
	activeRequest = {req:newRequest,interact:false};
}

function main(){
	var args = require('minimist')(process.argv.slice(2),{alias:{help:'h',dir:'d',file:'f'}});
	if(args.help){
		console.info('Usage bot {OPTIONS}');
		console.info('    --help\tShow this message');
		console.info('    --dir,-d\tSpecify the directory to upload');
		console.info('    --new,-n\tStart a new session - erase history from previous session');
		console.info('    --server {server_url},-n\tspecify server to connect to - overrides config file');
		console.info('    --clear,-c\tStart a new context but don\'t erase other information');
		showCommandLineHelp();
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
		config.bot = {
			packages:[],//packages the bot should use
			cid:require('uuid').v4(),//conversation id - generate a new id for a new conversation
			configuration:[],
			download:'download'};//directory used for downloaded files
		saveConfig();
	}
	
	if(args.clear){
		//start a new conversation by generating a new conversation id
		config.bot.cid = require('uuid').v4();
		saveConfig();
	}
	
	//connect to server
	context.token = config.token; //set the request token
	context.userid = config.userid || null; //set the request context userid
	if(config.bot.keys){
		context.keys = config.bot.keys;
	}
	if(!config.bot.user){
		config.bot.user = {};
		saveConfig();
	}
	context.user = config.bot.user;
	client.connect(args.server || config.server || DEFAULTSERVER,config.token).then(()=>{
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
				processText(line);
			}
		});

	}).catch((err)=>{
		showError(err);
		process.exit(1);
	});
}

function readFileSyncSafe(file,opts){
	try{
		return fs.readFileSync(file,opts);
	}catch(e){
		return null;
	}
}

main();
