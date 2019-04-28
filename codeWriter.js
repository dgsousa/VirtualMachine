const fs = require('fs');
const Parser = require('./parser.js');

const callCommands = (functionName, index, numArgs) => ({
	'push return-address': [ `@${functionName}$ret.${index}`, 'D=A', '@SP', 'A=M', 'M=D', '@SP', 'M=M+1' ],
	'push LCL': [ '@LCL', 'D=M', '@SP', 'A=M', 'M=D', '@SP', 'M=M+1' ],
	'push ARG': [ '@ARG', 'D=M', '@SP', 'A=M', 'M=D', '@SP', 'M=M+1' ],
	'push THIS': [ '@THIS', 'D=M', '@SP', 'A=M', 'M=D', '@SP', 'M=M+1' ],
	'push THAT': [ '@THAT', 'D=M', '@SP', 'A=M', 'M=D', '@SP', 'M=M+1' ],
	'ARG=SP-n-5': [ '@SP', 'D=M', `@${numArgs}`, 'D=D-A', '@5', 'D=D-A', '@ARG', 'M=D' ],
	'LCL=SP': [ '@SP', 'D=M', '@LCL', 'M=D' ],
	'goto f': [ `@${functionName}`, 'D;JMP' ],
	'(return-address)': [ `(${functionName}$ret.${index})` ]
});

const returnCommands = {
	'FRAME=LCL': [ '@LCL', 'D=M', '@FRAME', 'M=D' ],
	'RET=*(FRAME-5)': [ '@FRAME', 'D=M', 'D=D-1', 'D=D-1', 'D=D-1', 'D=D-1', 'D=D-1', 'A=D', 'D=M', '@RET', 'M=D' ],
	'*ARG=pop()': [ '@SP', 'M=M-1', 'A=M', 'D=M', 'M=0', '@ARG', 'A=M', 'M=D' ],
	'SP=ARG+1': [ '@ARG', 'D=M', '@SP', 'A=M', 'M=0', '@SP', 'M=D+1' ],
	'THAT=*(FRAME-1)': [ '@FRAME', 'D=M', 'D=D-1', 'A=D', 'D=M', '@THAT', 'M=D' ],
	'THIS=*(FRAME-2)': [ '@FRAME', 'D=M', 'D=D-1', 'D=D-1', 'A=D', 'D=M', '@THIS', 'M=D' ],
	'ARG=*(FRAME-3)': [ '@FRAME', 'D=M', 'D=D-1', 'D=D-1', 'D=D-1', 'A=D', 'D=M', '@ARG', 'M=D' ],
	'LCL=*(FRAME-4)': [ '@FRAME', 'D=M', 'D=D-1', 'D=D-1', 'D=D-1', 'D=D-1', 'A=D', 'D=M', '@LCL', 'M=D' ],
	'goto RET': [ '@RET', 'A=M', 'D;JMP' ]
}

const SEQ = {
	'Binary_OP': (op) => [ '@SP', 'M=M-1', 'A=M', 'D=M', '@SP', 'M=M-1', 'A=M', op, '@SP', 'M=M+1', 'A=M', 'M=0' ],
	'Unary_OP': (op) => [ '@SP', 'M=M-1', 'A=M', op, '@SP', 'M=M+1' ],
	'Comp_OP': index => ([ pri, sec ]) => [
		'@SP', 'M=M-1', 'A=M', 'D=M', '@SP', 'M=M-1', 'A=M', 'D=M-D', `@COMP${index}`, `D;${pri}`,
		'@SP', 'A=M', 'M=0', `@DONE${index}`, `D;${sec}`, `(COMP${index})`,
		'@SP', 'A=M', 'M=-1', `(DONE${index})`,
		'@SP', 'M=M+1', 'A=M', 'M=0'
	],
	'Push_MEM': (code, val) => [ `@${code}`, 'D=M', `@${val}`, 'A=D+A', 'D=M', '@SP', 'A=M', 'M=D', '@SP', 'M=M+1' ],
	'Pop_MEM': (code, val) => [ `@${code}`, 'D=M', `@${val}`, 'D=D+A', '@R13', 'M=D', '@SP', 'M=M-1', 'A=M', 'D=M', 'M=0', '@R13', 'A=M', 'M=D', '@R13', 'M=0' ],
	'Push_Constant': (val) => [ `@${val}`, 'D=A', '@SP', 'A=M', 'M=D', '@SP', 'M=M+1' ],
	'Pop_Constant': () => [ '@SP', 'A=M', 'M=0', '@SP', 'M=M-1' ],
	'Push_TempOrPointer': (code, val) => [ `@${code}`, 'D=A', `@${val}`, 'A=D+A', 'D=M', '@SP', 'A=M', 'M=D', '@SP', 'M=M+1' ],
	'Pop_TempOrPointer': (code, val) => [ `@${code}`, 'D=A', `@${val}`, 'D=D+A', '@R13', 'M=D', '@SP', 'M=M-1', 'A=M', 'D=M', 'M=0', '@R13', 'A=M', 'M=D', '@R13', 'M=0' ],
	'Push_Static': (fileName, val) => [ `@${fileName}.${val}`, 'D=M', '@SP', 'A=M', 'M=D', '@SP', 'M=M+1' ],
	'Pop_Static': (fileName, val) => [ '@SP', 'M=M-1', 'A=M', 'D=M', 'M=0', `@${fileName}.${val}`, 'M=D' ],
	'IfGoTo': (label) => [ '@SP', 'A=M', 'M=0', '@SP', 'M=M-1', '@SP', 'A=M', 'D=M', `@${label}`, 'D;JNE'],
	'GoTo': (label) => [ `@${label}`, 'D;JMP' ],
}

const COMP_MAP = {
	'eq': ['JEQ', 'JNE'],
	'gt': ['JGT', 'JLE'],
	'lt': ['JLT', 'JGE']
}

// SP, Pointer
const MEM_SEG_MAP = {
	'local': 'LCL',
	'argument': 'ARG',
	'this': 'THIS',
	'that': 'THAT',
}

const functionCallIndexes = {};


const ARITHMETIC_BLOCKS = (index) => {
	const binaryOp = SEQ['Binary_OP'];
	const unaryOp = SEQ['Unary_OP'];
	const compOp = SEQ['Comp_OP'](index);
	return {
		'add': binaryOp('M=D+M'),
		'sub': binaryOp('M=M-D'),
		'and': binaryOp('M=D&M'),
		'or': binaryOp('M=D|M'),
		'not': unaryOp('M=!M'),
		'neg': unaryOp('M=-M'),
		'eq': compOp(COMP_MAP['eq']),
		'gt': compOp(COMP_MAP['gt']),
		'lt': compOp(COMP_MAP['lt']),
	}
}


class CodeWriter {
	constructor(contentTree, path) {
		this.contentTree = contentTree;
		this.currentFileIndex = -1;
		this.currentPath;
		this.currentContents;
		this.currentParser;
		this.currentStream = this.setCurrentStream(path);
		this.writeInit();
	}

	setCurrentStream(path) {
		if(path.indexOf('.vm') > -1) return fs.createWriteStream(path.replace(/.vm/, '.asm'));
		const pathArray = path.split('/');
		const fileName = pathArray[pathArray.length - 2];
		return fs.createWriteStream(`${path}${fileName}.asm`);
	}

	translateFile() {
		const parser = this.currentParser;
		while(parser.hasMoreCommands()) {
			parser.advance();
			const commandType = parser.commandType();
			if(commandType === 'C_ARITHMETIC') {
				this.writeArithmetic();
			} else if(commandType === 'C_PUSH' || commandType === 'C_POP') {
				this.writePushPop();
			} else if(commandType === 'C_LABEL') {
				this.writeLabel();
			} else if(commandType === 'C_GOTO') {
				this.writeGoTo();
			} else if(commandType === 'C_IF') {
				this.writeIfGoTo();
			} else if(commandType === 'C_FUNCTION') {
				this.writeFunction();
			} else if(commandType === 'C_RETURN') {
				this.writeReturn();
			} else if(commandType === 'C_CALL') {
				this.writeCall();
			}
		}
	}

	translateContentTree() {
		while(this.currentFileIndex <= Object.keys(this.contentTree).length) {
			this.moveToNextFile();
			this.translateFile();
		}
		this.closeCurrentStream();
	}

	writeInit() {
		const initStack = [ '@256', 'D=A', '@SP', 'M=D' ];
		const callSysInit = callCommands('Sys.init', 1, 0);
		this.currentStream.write(`// bootstrap code\n`);
		initStack.forEach(line => {
			this.currentStream.write(line + '\n');
		})
		Object.keys(callSysInit).forEach(seq => {
			callSysInit[seq].forEach(line => {
				this.currentStream.write(line + '\n');
			})
		});
	}

	writeCall() {
		const parser = this.currentParser;
		const commandIndex = parser.currentIndex - 1;
		const command = parser.command;
		const functionName = parser.arg1();
		const numArgs = parser.arg2();
		functionCallIndexes[`${functionName}`] = ++functionCallIndexes[`${functionName}`] || 1;
		const callIndex = functionCallIndexes[`${functionName}`];
		const callSequence = callCommands(functionName, callIndex, numArgs);
		this.currentStream.write(`// ${commandIndex}: ${command.join(' ')} + '\n`);
		Object.keys(callSequence).forEach(seq => {
			callSequence[seq].forEach(line => {
				this.currentStream.write(line + '\n');
			})
		});
	}

	writeFunction() {
		const parser = this.currentParser;
		const commandIndex = parser.currentIndex - 1;
		const command = parser.command;
		const functionName = parser.arg1();
		const localVars = parser.arg2();
		this.currentStream.write(`// ${commandIndex}: ${command.join(' ')} + '\n`);
		this.currentStream.write(`(${functionName})` + '\n');
		for(let i = 0; i < localVars; i++) {
			const pushSequence = this.memoryAccessCommands('push', 'constant', 0);
			const popSequence = this.memoryAccessCommands('pop', 'local', i);
			this.currentStream.write(`// push constant 0 for the ${i}th time\n`);
			pushSequence.forEach(line => {
				this.currentStream.write(line + '\n');
			}); 
		}
	}

	writeReturn() {
		const parser = this.currentParser;
		const commandIndex = parser.currentIndex - 1;
		const command = parser.command;
		this.currentStream.write(`// ${commandIndex}: ${command.join(' ')} + '\n`);
		Object.keys(returnCommands).forEach(command => {
			returnCommands[command].forEach(line => {
				this.currentStream.write(`${line}\n`);
			})
		})
	}

	writeArithmetic() {
		const parser = this.currentParser;
		const command = parser.command[0];
		const commandIndex = parser.currentIndex - 1;
		this.currentStream.write(`// ${commandIndex}: ${command}` + '\n');
		ARITHMETIC_BLOCKS(commandIndex)[command].forEach(line => {
			this.currentStream.write(line + '\n');
		});
	}

	writePushPop() {
		const parser = this.currentParser;
		const command = parser.command;
		const commandIndex = parser.currentIndex - 1;
		const commandType = command[0];
		const memSeg = parser.arg1();
		const val = parser.arg2();
		const sequence = this.memoryAccessCommands(commandType, memSeg, val);
		this.currentStream.write(`// ${commandIndex}: ${command.join(' ')}` + '\n');
		sequence.forEach(line => {
			this.currentStream.write(line + '\n');
		})
	}

	writeLabel() {
		const parser = this.currentParser;
		const commandIndex = parser.currentIndex - 1;
		const command = parser.command;
		const label = parser.arg1();
		this.currentStream.write(`// ${commandIndex}: ${command.join(' ')} + '\n`);
		this.currentStream.write(`(${label})` + '\n');
	}

	writeGoTo() {
		const parser = this.currentParser;
		const commandIndex = parser.currentIndex - 1;
		const command = parser.command;
		const label = parser.arg1();
		const sequence = SEQ['GoTo'](label);
		this.currentStream.write(`// ${commandIndex}: ${command.join(' ')} + '\n`);
		sequence.forEach(line => {
			this.currentStream.write(line + '\n');
		});
	}

	writeIfGoTo() {
		const parser = this.currentParser;
		const commandIndex = parser.currentIndex - 1;
		const command = parser.command;
		const label = parser.arg1();
		const sequence = SEQ['IfGoTo'](label);
		this.currentStream.write(`// ${commandIndex}: ${command.join(' ')} + '\n`);
		sequence.forEach(line => {
			this.currentStream.write(line + '\n');
		});
	}

	getWritePath(path) {
		return path.replace(/.vm/, '.asm');
	}

	moveToNextFile() {
		this.incrementFileIndex();
		if(this.currentFileIndex <= Object.keys(this.contentTree).length - 1) {
			this.setCurrentPath();
			this.setCurrentFileName();
			this.setCurrentContents();
			this.setCurrentParser();
		}
	}

	incrementFileIndex() {
		this.currentFileIndex += 1;
	}

	setCurrentPath() {
		this.currentPath = Object.keys(this.contentTree)[this.currentFileIndex];
	}

	setCurrentFileName() {
		const fileArr = this.currentPath.split('/');
		this.fileName = fileArr[fileArr.length -1];
	}

	setCurrentContents() {
		this.currentContents = this.contentTree[this.currentPath];
	}

	setCurrentParser() {
		this.currentParser = new Parser(this.currentContents);
	}

	closeCurrentStream() {
		this.currentStream.end();
	}

	memoryAccessCommands(commandType, memSeg, val) {
		const pushCommand = SEQ['Push_MEM'];
		const popCommand = SEQ['Pop_MEM'];
		const pushConstant = SEQ['Push_Constant'];
		const popConstant = SEQ['Pop_Constant'];
		const pushTempOrPointer = SEQ['Push_TempOrPointer'];
		const popTempOrPointer = SEQ['Pop_TempOrPointer'];
		const pushStatic = SEQ['Push_Static'];
		const popStatic = SEQ['Pop_Static'];
		const fileName = this.fileName.slice(0, this.fileName.length - 3);
		if (
			memSeg === 'local' ||
			memSeg === 'argument' ||
			memSeg === 'this' ||
			memSeg === 'that'
		) {
			const code = MEM_SEG_MAP[memSeg];
			return commandType === 'push' ? pushCommand(code, val) : popCommand(code, val);
		} else if (memSeg === 'constant') {
			return commandType === 'push' ? pushConstant(val) : popConstant(val);
		} else if (memSeg === 'temp') {
			return commandType === 'push' ? pushTempOrPointer('R5', val) : popTempOrPointer('R5', val);
		} else if (memSeg === 'static') {
			return commandType === 'push' ? pushStatic(fileName, val) : popStatic(fileName, val);
		} else if (memSeg === 'pointer') {
			return commandType === 'push' ? pushTempOrPointer('R3', val) : popTempOrPointer('R3', val);
		}
	}
}

module.exports = CodeWriter;