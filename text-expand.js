//expand full request from integer of possible actions, answers etc
var actions = {};

module.exports = {
	reset : function(){actions = {};},
	store : function(key,value){actions[key]=value;},
	get : function(key){return actions[key];}
};