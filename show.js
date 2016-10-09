const colors = require('colors');
const Table = require('cli-table2');
const fs = require('fs');
const path = require('path');

const MAX_TABLE_LENGTH = 140;
const CELL_PADDING = 2;
/* jshint laxbreak:true */


module.exports = function(obj,type,config){
	type = type 
		|| obj.type 
		|| (Array.isArray(obj)?'list':null) 
		|| (obj.$meta && obj.$meta.type? obj.$meta.type : null);
	
	switch(type){
		case 'send':
			console.info(obj.yellow);
			return true;
		case 'error':
			console.info(obj.red.bold);
			return true;
		case 'receive':
			console.info(obj.cyan);
			return true;
		case 'log':
			console.info(obj.grey);
			return true;
		case 'entity-list':
			return showList(obj);
		case 'table':
			return showTable(obj);
		case 'file':
			return showFile(obj,config);
		default:
			return false;
	}
};

function showList(obj){
	let table = new Table({colWidths:[7,80]});
	for(let i=0;i<obj.length;++i){
		table.push(['#' + (i+1),as(obj[i],'entity-summary','text')]);
	}
	console.info(table.toString());
	return true;
}

function calculateColWidths(rows){
	var ret = [];
	for(let i=0;i<rows.length;++i){
		for(let j=0;j<rows[i].length;++j){
			let cell = asText(rows[i][j]);
			ret[j] = Math.max(ret[j] || 0,cell.length + CELL_PADDING);
		}
	}
	//now we have max lengths for each column - see if it exceeds max_table_length
	let total = ret.reduce((prev,curr)=>{
		return prev+curr;
	},0);
	if(total <= MAX_TABLE_LENGTH){
		//columns fit in max width
		return ret;
	}
	//length cannot exceed average column length
	let average = MAX_TABLE_LENGTH / ret.length;
	ret = ret.map((elem)=>Math.min(elem,average));
	
	//now distribute the left width among the different columns
	total = ret.reduce((prev,curr)=>{
		return prev+curr;
	},0);
	let left = MAX_TABLE_LENGTH - total;
	
	//check how many columns need addition
	let needMore = ret.reduce((prev,curr)=>{
		return (curr === average? prev+1:prev);
	},0);
	let add = needMore === 0? 0 : left / needMore;
	ret = ret.map((elem)=>(elem === average? Math.floor(elem + add) : elem));
	return ret;
}

function showTable(obj){
	let table = new Table({
		colWidths : [7].concat(calculateColWidths(obj.rows)),
		head : [""].concat(obj.columns),
		style : {compact:true}});
	obj.rows.forEach((elem,index)=>{
		table.push([index+1].concat(asText(elem)));
	});
	console.log(table.toString());
	return true;
}

function as(obj,from,to){
	switch(from + '|' + to){
		case 'entity-summary|text':
			return obj.name || obj.title || obj.description || obj.content ||  obj.link;
		default:
			return null;
	}
}

function asText(obj){
	if(obj === null || obj === undefined){
		return "";
	}else if(!isNaN(Date.parse(obj))){
		return new Date(obj).toLocaleString();
	}else{
		return obj.toString();
	}
}

/**
 * Download a file - save it in the configured download directory.
 * If file already exists then append a number to it (file1, file2 etc.)
 * @param {[[Type]]} file   [[Description]]
 * @param {[[Type]]} config [[Description]]
 */
function showFile(file,config){
	const buf = Buffer.from(file.data,'base64');
	saveFile(file.filename,buf,config.download || 'download');
}

function saveFile(filename,buf,dir,counter){
	return new Promise((resolve,reject)=>{
		try{
			let parsed = path.parse(filename);
			parsed.name += (counter || '');
			parsed.dir = dir;
			delete parsed.base;
			fs.writeFileSync(path.format(parsed),buf,{flag:'wx'});
			resolve();
		}catch(e){
			reject(e.code);
		}
	}).catch((err)=>{
		if(err === 'EEXIST'){
			return saveFile(filename,buf,dir,(counter || 0)+1);
		}
		if(err === 'ENOENT'){
			fs.mkdirSync(dir);
			return saveFile(filename,buf,dir);
		}
		console.error('Error saving downloaded file - ' + err);
		return Promise.reject(err);
	});
}