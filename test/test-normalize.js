const fs = require('fs-extra');
const tap = require('tap');
let input = fs.readJsonSync('input.dic');
let target = fs.readJsonSync('target.dic');
let output = require('../normalize-dictionary')(input);

tap.test('testing dictionary normalizer',function(t){
	output = JSON.parse(JSON.stringify(output));
	for(let i=0;i<target.length;++i){
		t.same(output[i],target[i]);
	}
	t.equals(output.length,target.length,"length of target array and output array should equal");
	t.end();
});
