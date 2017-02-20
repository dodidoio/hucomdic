#!/usr/bin/env node
const DEFAULTSERVER = "wss://assist.dodido.io";
const fs = require('fs-extra');
const pathLib = require('path');
const server = require('dodido-client');


module.exports = function(server,args){
	let ret = server.showLogs();
	ret.on('error',(err)=>console.error(err));
	ret.on('log',(message)=>console.log(message));
	return ret;
};
