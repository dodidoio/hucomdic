

start = pattern
pattern = e:patternElement*{return {seq:e,text:text()}}
patternElement = stringElement / typeElement / directive
stringElement = c:patternChar+{return {type:'string',text:c.join('')};}
patternChar = [^\{\[\\=\(\<] / escapedChar{return text()[1]} / "=" !">"{return text()}
directiveChar = [^\}] / "\\}" {return "\u007d";}
escapedChar = "\\[" / "\\{" / "\\(" / "\\<" / "\\\\" / "\\="
type = [a-z] [a-z0-9\- \.]*{return text();}
name = [a-z] [a-z0-9\- ]*{return text();}
typeElement = "[" + t:type + "]"{return {type:'type',text:t.join('')};}
//directive = "{" + d:directiveCmdSeq + "}"{return {type:'directive',seq:d,text:d.map((e)=>e.text).join(';')};}
directive = "{" + d:directiveChar + "}"{return {type:'directive',text:d.join('')};}
directiveCmdSeq = h:directiveCmd {return h;} / h:directiveCmd t:(sp? ";" sp? directiveCmd)+{
	return [h].concat(t.map((e)=>e[3]));}
sp = " "+
integer = [1-9][0-9]+{return parseInt(text());}
directiveCmd = rankCmd / eqCmd
rankCmd = "rank is " i:integer{return {cmd:'rank',arg:i,text:text()};}
eqCmd = p1:name " of the " o1:name (" eq "/" equals "/" is equal to ") p2:name " of the " o2:name{return {cmd:'eq',o1:o1,o2:o2,p1:p1,p2:p2,text:text()};}
