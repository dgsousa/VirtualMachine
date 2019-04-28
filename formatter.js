
const fs = require('fs');


function formatter(path) {
	const file = fs.readFileSync(path, 'utf8');
	return file
		.split('\n')
		.filter(line => !isComment(line) && !isBlankLine(line))
		.map(removeWhitespaceAndComments);
}

// helper functions

function isComment(line) {
	return line.substring(0, 2) === '//';
}

function isBlankLine(line) {
	const newLine = line
		.split('')
		.filter(char => char !== '' && char !== ' ' && char !== '\r')
	return newLine.length === 0;
}

function removeWhitespaceAndComments(line) {
	let counter = 0;
	let formatted = '';
	const splitLine = line.split('');
	while(splitLine[counter] === '' || splitLine[counter] === ' ') {
		counter++;
	}
	while(
		splitLine[counter] &&
		splitLine[counter] !== '/' &&
		splitLine[counter] !== '\r') {
		formatted += splitLine[counter];
		counter++;
	}
	return formatted.split(' ').filter(word => word !== '').join(' ');
}

module.exports = formatter;
