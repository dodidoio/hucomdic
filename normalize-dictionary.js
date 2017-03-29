/* jshint esversion:6 */
const pluralize = require('pluralize');
const DEFAULT_TYPE = 'action';

function error(message,entry){
	return {message:message,entry:entry};
}

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

function parseStringFormat(text){
	const match = text.match(/^(.*?)(?:\((.*?)\))?(?:(=>>|=>)(.+?))?(?:\/\/(.*))?$/);
	if(match){
		let generated = {};
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
		return generated;
	}else{
		return null;
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
	let parsed = parseStringFormat(entry);
	if(parsed){
		parsed.entry = 'pattern';
		writer(parsed);
	}else{
		throw error("Cannot parse the string entry",entry);
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
		if(typeof entry.name !== 'string'){
			if(entry.type){
				entry.name = entry.type;
			}else{
				throw error('Concept entry must have a name',entry);
			}
		}
		entry.plural = typeof entry.name === 'string'? pluralize.plural(entry.name) : undefined;
		
		//process properties
		(entry.properties||[]).forEach((prop)=>{
			if(typeof prop === 'string'){
				//we are using here the shorthand text format - parse it
				let match = prop.match(/^([^\(]+?)\s*(?:\((.+?)\))?\s*(?:\/\/(.*))?$/);
				prop = {name:match[1],type:match[2]||match[1],description:match[3]};
			}
			prop.entry = 'property';
			prop.$container = "concept:" + (entry.name||entry.type);
			prop._contained = true;
			normalizeProperty(writer,prop);
		});
		
		//process traits
		(entry.traits||entry.trait || []).forEach((trait)=>{
			let generated = null;
			if(typeof trait === 'string'){
				generated = parseStringFormat(trait);
				if(!generated){
					throw error("Cannot parse trait in concept" + entry.name,trait);
				}
			}else{
				generated = trait;
			}
			generated.entry = 'trait';
			generated.$container = 'concept:' + entry.name;
			generated._contained = true;
			delete generated.type;
			writer(generated);
		});
		
		//process creators
		(entry.creators||entry.creator || []).forEach((creator)=>{
			let generated = null;
			if(typeof creator === 'string'){
				generated = parseStringFormat(creator);
				if(!generated){
					throw error("Cannot parse cerator in concept" + entry.name,creator);
				}
				generated.pattern = generated.pattern + "=>" + generated.bind;
				delete generated.bind;
			}else{
				generated = creator;
			}
			generated._contained = true;
			generated.entry = 'creator';
			generated.$container = 'concept:' + entry.name;
			writer(generated);
		});

		entry.name = entry.name || entry.type;
		entry.type = entry.type || entry.name;
	}
	writer(entry);
}

/**
 * add a name to the entry based on the pattern. This is active for connectors and traits
 * it is helpful for debug situations
 * @param {[[Type]]} writer [[Description]]
 * @param {[[Type]]} entry  [[Description]]
 */
function normalizeNames(writer,entry){
	if(!entry.name){
		if(entry.entry === 'connector'||entry.entry === 'is connector'){
			if(typeof entry.$container !== 'string'){
				throw error('Connectors must have $container property',entry);
			}
			let matched = entry.$container.match(/^concept\:(.+)$/);
			if(!matched){
				throw error("Connectors must have concept containers",entry);
			}
			entry.name = `the ${matched[1]} ${entry.pattern} the ${entry.property}`;
		}
		if(entry.entry === 'trait'||entry.entry === 'is trait'){
			if(typeof entry.$container !== 'string'){
				throw error('traits must have $container property',entry);
			}
			let matched = entry.$container.match(/^concept\:(.+)$/);
			if(!matched){
				throw error("traits must have concept containers",entry);
			}
			entry.name = entry.pattern.replace(/\[([a-zA-Z0-9\s\-]+)\]/g,"a $1");
		}
	}
	writer(entry);
}
	
function normalizeTrait(writer,entry){
	if(entry.entry==='trait'){
		if(typeof entry.pattern !== 'string'){
			throw error("Trait entry must have a pattern property",entry);
		}
		
		let matched = entry.pattern.match(/^([a-z]+)\s+(.+)$/);
		if(!matched){
			throw error("There was a problem with the trait pattern",entry);
		}
		if(matched[1]==='is'){
			//this is an is trait
			entry.entry = 'is trait';
			entry.pattern = matched[2];
		}else{
			//add plural pattern
			let newTrait = {};
			Object.assign(newTrait,entry);
			newTrait.pattern = `${pluralize.plural(matched[1])} ${matched[2]}`;
			if(newTrait.name){
				newTrait.name = newTrait.name + '*';
			}
			writer(newTrait);
		}
	}
	writer(entry);
}

function normalizeConnector(writer,entry){
	if(entry.entry==='connector'){
		if(typeof entry.pattern !== 'string'){
			throw error("Connector entry must have a pattern property",entry);
		}
		let matched = entry.pattern.match(/^([a-z]+)\s+(.+)$/);
		if(!matched){
			throw error("There was a problem with the connector pattern",entry);
		}
		if(matched[1]==='is'){
			//this is an is connector
			entry.entry = 'is connector';
			entry.pattern = matched[2];
		}
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
		
		//generate connectors
		let connectors = entry.connector||entry.connectors || [];
		if(!Array.isArray(connectors)){
			connectors = [connectors];
		}
		connectors.forEach((connector)=>writer({
				entry:'connector',
				$container:entry.$container,
				pattern:connector,
				property:entry.name,
				_contained : true,
				type:entry.type
			}));
	}
	writer(entry);
}

/**
 * Turn property options into entities
 * @param {[[Type]]} writer [[Description]]
 * @param {object}   entry  [[Description]]
 */
function normalizePropertyOptions(writer,entry){
	if(entry.entry === 'property'){
		if(entry.options){
			//if there is not entry type, generate a type as random string
			if(!entry.type){
				entry.type = 't' + Math.random().toString(36).substr(2);
			}
			if(!Array.isArray(entry.options)){
				entry.options = [entry.options];
			}
			entry.options.forEach((option)=>{
				writer({
					entry:'pattern',
					pattern:option,
					type:entry.type,
					output:JSON.stringify(option)
				});
			});
		}
	}
	writer(entry);
}



function logger(writer,entry){
	console.info('ENTRY',JSON.stringify(entry));
	writer(entry);
}


function copy(x){
	if(typeof x !== 'object'){
		return x;
	}else{
		let ret = {};
		Object.assign(ret,x);
		return ret;
	}
}

/**
 * Normalize a dictionary json construct. If the dictionary is an array of entries, each entry is normalized
 * in sequence. If it is an object, its entries property is assumed to contain an array of entries
 * @param   {object}   dictionary   an array of entries or an object with property entries containing 
 *                                an array of entries
 * @param   {Function} errorHandler an optional handler of errors in the form of handler(entry,message)
 * @param   {string}   config processing configuration. display - used to display entries - hiding entries that are generated as hacks to improve parsing performance and accuracy
 * @returns {object}   a dictionary object with an entries property containing normalized entries
 */
module.exports = function(dictionary,errorHandler,config){
	let pipe = pipeNormalizer([normalizeFullStringFormat, normalizeEntryField, normalizeOutput, normalizeConcept, normalizeProperty, normalizePropertyOptions, normalizeNames, normalizeTrait, normalizeConnector]);
	if(config === 'display'){
		pipe = pipeNormalizer([normalizeFullStringFormat, normalizeEntryField, normalizeOutput, normalizeConcept,normalizeProperty]);
	}
	let entries = 
			Array.isArray(dictionary)?dictionary:
			Array.isArray(dictionary.entries)?dictionary.entries : [];
	let output = [];
	entries.forEach((entry)=>{
		try{
			pipe((e)=>output.push(e),copy(entry));
		}catch(e){
			let errMessage = e.message || e.toString();
			let errEntry = e.entry || entry;
			if(typeof errorHandler === 'function'){
				errorHandler(errEntry,errMessage);
			}else{
				console.error("Error processing entry:",JSON.stringify(errEntry),"==>",errMessage);
			}
		}});
	if(Array.isArray(dictionary)){
		return {entries:output};
	}else{
		let ret = {};
		Object.assign(ret,dictionary);
		ret.entries = output;
		return ret;
	}
};
