const t = require('tap');
const p = require('../parse').parse;
t.test('test parse pattern',function(t){
	let x = p('abcd');
	t.assert(x.seq[0].type === 'string' && x.seq[0].text==='abcd','simple string');
	x = p('ab\\\\ \\[] \\{} \\() \\< \\=>');
	t.equal(x.seq[0].text,'ab\\ [] {} () < =>','escaped characters');
	x = p('=x');
	t.equal(x.seq[0].text,'=x','equal followed by anything that is not =');
	x = p('what [is the] type');
	t.assert(x.seq[1].text ==='is the' && x.seq[1].type === 'type','type element');
	x = p('what {rank is 34} type');
	t.assert(
		x.seq[1].text ==='rank is 34' && 
		x.seq[1].type === 'directive' &&
		x.seq[1].seq[0].cmd === 'rank' &&
		x.seq[1].seq[0].arg === 34,
		'rank directive');
	x = p('{father of the child eq mother of the aunt}');
	t.equal(JSON.stringify(x.seq[0][0]),'','eq command');
	
	
	t.end();
});
