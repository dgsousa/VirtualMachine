const command_map = {
	'push': 'C_PUSH',
	'pop': 'C_POP',
	'add': 'C_ARITHMETIC',
	'sub': 'C_ARITHMETIC',
	'neg': 'C_ARITHMETIC',
	'eq': 'C_ARITHMETIC',
	'gt': 'C_ARITHMETIC',
	'lt': 'C_ARITHMETIC',
	'and': 'C_ARITHMETIC',
	'or': 'C_ARITHMETIC',
	'not': 'C_ARITHMETIC',
	'label': 'C_LABEL',
	'goto': 'C_GOTO',
	'if-goto': 'C_IF',
	'function': 'C_FUNCTION',
	'return': 'C_RETURN',
	'call': 'C_CALL',
}

class Parser {
  constructor(fileContents) {
		this.fileContents = fileContents;
		this.currentIndex = 0;
    	this.command;
	}
	
	hasMoreCommands() {
		return this.currentIndex < this.fileContents.length;
	}

	advance() {
		this.command = this.fileContents[this.currentIndex].split(' ');
		this.currentIndex++;
	}

	commandType() {
		return command_map[this.command[0]];
	}

	arg1() {
		const commandType = this.commandType();
		if(commandType === 'C_ARITHMETIC') return this.command[0];
		else return this.command[1];
	}

	arg2() {
		return this.command[2];
	}
}

module.exports = Parser;