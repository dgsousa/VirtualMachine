const fs = require('fs');
const nodePath = require('path');
const formatter = require('./formatter.js');
const CodeWriter = require('./codeWriter.js');
const path = process.argv[2];

function recurseThroughDirectory(path) {
	const paths = [];
	const currentPathObject = { currentPath: path };
	const pathQueue = [currentPathObject];
	while(pathQueue.length > 0) {
		const dir = pathQueue.pop();
		const currentPath = dir.currentPath;
		const stat = fs.lstatSync(currentPath);
		if(!stat.isDirectory() && nodePath.extname(currentPath) === '.vm') paths.push(currentPath);
		else if(stat.isDirectory()) {
			fs.readdirSync(currentPath).forEach(subPath => {
				pathQueue.push({
					currentPath: `${currentPath}/${subPath}`
				})
			})
		}
	}
	return paths;
}


function getContentTree(path) {
	const stat = fs.lstatSync(path);
	const contents = {};
	if(stat.isDirectory()) {
		const fileArray = recurseThroughDirectory(path);
		fileArray.forEach(filePath => {
			contents[filePath] = formatter(filePath);
		})
	} else {
		const fileContents = formatter(path);
		contents[path] = fileContents;
	}
	return contents;
}


function main(path) {
	const contentTree = getContentTree(path);
	const codeWriter = new CodeWriter(contentTree, path);
	codeWriter.translateContentTree();
}


main(path);