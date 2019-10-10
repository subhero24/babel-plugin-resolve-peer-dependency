import Path from 'path';
import Resolve from 'resolve-from';
import Filesystem from 'fs';

const transform = (plugin, dependency) => {
	if (plugin.cwd === process.cwd()) {
		return dependency;
	} else {
		let packageFilename = Path.join(plugin.cwd, 'package.json');
		if (Filesystem.existsSync(packageFilename)) {
			let packageJSON = require(packageFilename);
			let peerDependencies = packageJSON.peerDependencies || {};
			for (let peerDependency in peerDependencies) {
				if (dependency === peerDependency || dependency.startsWith(peerDependency + '/')) {
					let localDependency = Resolve.silent(process.cwd(), dependency);
					if (localDependency == undefined) {
						console.warn(
							`Peerdependency '${peerDependency}' was not found in main package. '${dependency}' will not be resolved.`,
						);
						return dependency;
					} else {
						let relativeRoot = Path.relative(plugin.cwd, process.cwd());
						let relativeLocalDependency = Path.relative(process.cwd(), localDependency);
						let relativeDependency = Path.join(relativeRoot, relativeLocalDependency);

						console.log(
							`The dependency '${dependency}' was specified as a peerDependency in ${
								packageJSON.name
							}. Transforming it to ${relativeDependency} to use package '${dependency}' from the project in the current working directory`,
						);

						return relativeDependency;
					}
				}
			}
		}

		return dependency;
	}
};

const Plugin = ({ types }) => {
	const traverseExpression = (type, arg) => {
		if (type.isStringLiteral(arg)) {
			return arg;
		}

		if (type.isBinaryExpression(arg)) {
			return traverseExpression(type, arg.left);
		}

		return null;
	};

	const visitor = {
		CallExpression(path) {
			if (path.node.callee.name === 'require' || path.node.callee.type === 'Import') {
				const args = path.node.arguments;
				if (!args.length) {
					return;
				}

				const firstArg = traverseExpression(types, args[0]);
				if (firstArg) {
					firstArg.value = transform(this, firstArg.value);
				}
			}
		},
		ImportDeclaration(path) {
			path.node.source.value = transform(this, path.node.source.value);
		},
		ExportNamedDeclaration(path) {
			if (path.node.source) {
				path.node.source.value = transform(this, path.node.source.value);
			}
		},
		ExportAllDeclaration(path) {
			if (path.node.source) {
				path.node.source.value = transform(this, path.node.source.value);
			}
		},
	};
	return {
		visitor: {
			Program(path) {
				path.traverse(visitor, this);
			},
		},
	};
};

export default Plugin;
