#!/usr/bin/env node
const DEFAULTSERVER = "wss://assist.dodido.io";
const fs = require('fs-extra');
const pathLib = require('path');
const server = require('dodido-client');
const colors = require('colors');


module.exports = function(server){
var args = require('minimist')(process.argv.slice(2),{
	alias:{user:'u',since:'s'},
	default:{tail:100}
});

	if(args.help){
		console.info([
			'Usage:  hucomdic logs [OPTIONS]',
			'Options:',
			'	\t--user\tuserid',
			'\t--tail\tnumber of log messages to show',
			'\t--start\tstart showing logs from timestamp'
			].join('\n'));
			
		process.exit(0);
	}

	let opts = {start:args.start || null,limit:args.tail||100,userid:args.user||null};
	let ret = server.showLogs(opts);
	ret.on('error',(err)=>console.error(err.red.bold));
	ret.on('log',(message)=>console.info(message));
	return ret.then(()=>process.exit(0));
};
