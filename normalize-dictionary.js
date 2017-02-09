/* jshint esversion:6 */
const pluralize = require('pluralize');
const DEFAULT_TYPE = 'action';

function pipeNormalizer(first,second){
	if(!second || second.length === 0){
		return Array.isArray(first)?pipeNormalizer(first[0],first.slice(1)) : first;
	}
	if(Array.isArray(second)){
		return pipeNormalizer(first,pipeNormalizer(second));
	}
	return function(writer,entry){
		first(second.bind(this,writer),entry);
	};
}

/*
function packageNormalizer(writer,entry){
	if(entry.entry === 'package'){
		writer({
			name : 
			description:entry.description,
			access:entry.$access || entry.access,
			$include:(entry.$access||entry.access||"").split(',').map((include)=>'package#'+include.trim()).join(',').replace(',,',',');
		});
		(entry.entries || []).forEach((entry)=>{
			if(typeof entry === 'string'){
				
			}
		}
																 )
	}
}
*/
function outputFromPattern(pattern,bind){
	//first replace all patterns with []
	var ret = pattern.replace(/\[(^\])+?\]/g,"[]");
	
	//replace all [] in name with [n] where n is the position of the match in list of all matches
	var counter = {pos:0};
	ret = ret.replace(/\[[^\]]*\]/g,function(){return "[" + (++counter.pos) + "]";});
	
	//remove directives
	ret = ret.replace(/\{.*?\}/g,"");
	if(bind){
		ret += `(${bind})`;
	}
	return ret;
}

/**
 * Process conditions. Conditions are in the form of [type] is something with type boolean
 * @param {object} entry  the entry to process
 * @param {string} module the module
 */
function normalizeCondition(writer,entry){
	function turnStatementIntoCondition(output,pattern){
		function countArgs(str){
			var re = /(?:[^\\]|^)\[[^\]]*\]/g;
			var count = 0;
			while ((re.exec(str)) !== null)count++;
			return count;
		}
		let match = output.match(/([\$a-zA-Z_\-][\$\-\w]*)@(\S*)( .+)?\)/);

		if(!match)match = ['dummy',''];
		if(match[3]){
			//binding arguments are specified - replace $0 with reference to <it> and demote the numbers of the rest of the 
			//arguments. This is done because in the test pattern, the subject is not explicit. It will be deduced from the
			//context (using the <it> reference)
			output = match[1] + '@' + match[2] + match[3].replace(/\$(\d+)/g,(match,digits)=>{
				const n = parseInt(digits);
				if(n===0){
					return "it(frame)";
				}else{
					return `$${n-1}`;
				}
			});
		}else{
			//arguments are not specified - need to deduce them
			let nArgs = countArgs(pattern);
			output = match[1] + '@' + match[2] + " it(frame)";
			for(let i=0;i<nArgs;++i){
				output += (', $' + i);
			}
		}
		return '\\d' + outputFromPattern(pattern,output);
	}

	if(entry.type !== 'boolean'){
		//this is not a condition - conditions must have boolean types
		writer(entry);
	}
	var match1 = entry.pattern.match(/^\[([a-zA-Z\- ]+)\] is (.*)$/);//trait "[type] is something"
	var match2 = entry.pattern.match(/^\[([a-zA-Z\- ]+)\] (.*)$/);//condition "[type] starts with [text]"
	
	if(match1){
		writer({
			entry:'trait',
			pattern:match1[2],
			context: entry.context,
			$container:'type:' + match1[1],
			output:turnStatementIntoCondition(entry.output,match1[2])
		});
	}else if(match2){
		writer({
			entry:"assertion",
			pattern:match2[2],
			context: entry.context,
			$container:'type:' + match2[1],
			output:turnStatementIntoCondition(entry.output,match2[2])
		});
	}else{
		writer(entry);
	}
}

function normalizeMe(writer,entry){
	if(entry.pattern === 'me'){
		writer({
			entry:'self',
			bind:entry.bind,
			type: entry.type
		});
	}else{
		writer(entry);
	}
}

function normalizeFullStringFormat(writer,entry){
	if(typeof entry !== 'string'){
		writer(entry);
		return;
	}
	if(entry.match(/^\-\-/)){
		//this is a remark - do nothing
			return;
	}
	const match = entry.match(/^(.*?)(?:\((.*?)\))?(?:(=>>|=>)(.+?))?(?:\/\/(.*))?$/);
	if(match){
		let generated = {entry:'pattern'};
		generated.pattern = match[1];
		generated.type = match[2] || DEFAULT_TYPE;
		if(match[3]=='=>'){
			generated.bind = match[4];
		}else if(match[3]=='=>>'){
			generated.output = match[4];
		}else{
			generated.bind = `text@dodido/pojo ${JSON.stringify(outputFromPattern(match[1]))}`;
		}
		generated.description = match[5];
		writer(generated);
	}
}


/**
 * This the output property when not set
 * @param {[[Type]]} writer [[Description]]
 * @param {object}   entry  [[Description]]
 */
function normalizeOutput(writer,entry){
	if(entry.entry === 'pattern' && typeof entry.pattern === 'string'&& !entry.output){
		if(entry.bind){
			entry.output = outputFromPattern(entry.pattern,entry.bind);
		}else{
			entry.output = JSON.stringify(entry.pattern);
		}
	}
	writer(entry);
}

function normalizeEntryField(writer,entry){
	if(!entry.entry){
		if(entry.regex){
			entry.entry = 'regex';
			entry.name = entry.regex;
		}else{
			//default entry is pattern
			entry.entry = 'pattern';
		}
	}
	writer(entry);
}

function normalizeConcept(writer,entry){
	if(entry.entry === 'concept'){
		(entry.properties||[]).forEach((prop)=>{
			if(typeof prop === 'string'){
				//we are using here the shorthand text format - parse it
				let match = prop.match(/^([^\(]+?)\s*(?:\((.+?)\))?\s*(?:\/\/(.*))?$/);
				prop = {name:match[1],type:match[2]||match[1],description:match[3]};
			}
			prop.entry = 'property';
			prop.$container = "concept:" + (entry.name||entry.type);
			normalizeProperty(writer,prop);
		});
		entry.name = entry.name || entry.type;
		entry.type = entry.type || entry.name;
	}
	writer(entry);
}

function normalizeProperty(writer,entry){
	if(entry.entry === 'property'){
		entry.plural = typeof entry.name === 'string'? pluralize.plural(entry.name) : undefined;
		if(entry.type && entry.type.match(/^(.+)\*$/)){
			//this is a collection property
			entry.singular = pluralize.singular(entry.name);
			entry['item type'] = '[' + entry.type.match(/^(.*)\*$/)[1] + ']';
			entry['$item concept'] = "concept:"+entry.type.match(/^(.*)\*$/)[1];
			entry['property type'] = 'collection';
		}else if(entry.type && entry.type==='boolean'){
			//this is a trait
			entry['property type'] = 'trait';
		}else{
			entry['property type'] = 'property';
		}
	}
	writer(entry);
}

function logger(writer,entry){
	console.info('ENTRY',JSON.stringify(entry));
	writer(entry);
}

module.exports = function(dictionary){
	let pipe = pipeNormalizer([normalizeFullStringFormat, normalizeEntryField, normalizeOutput, normalizeConcept,normalizeProperty]);
	let entries = 
			Array.isArray(dictionary)?dictionary:
			Array.isArray(dictionary.entries)?dictionary.entries : [];
	let output = [];
	entries.forEach((entry)=>{
		try{
			pipe((e)=>output.push(e),entry);
		}catch(e){
			console.error("Error processing entry:",JSON.stringify(entry),"==>",e);
		}});
	if(Array.isArray(dictionary)){
		return {entries:output};
	}else{
		dictionary.entries = output;
		return dictionary;
	}
};
