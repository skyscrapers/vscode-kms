// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as AWS from 'aws-sdk';
import Window = vscode.window;
import Range = vscode.Range;
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('"vscode-kms" is now active!');

	context.subscriptions.push(vscode.commands.registerCommand('extension.kmsdecrypt', async () => {
		var aws = await createAWSConfig()
		decrypt(aws);
	}));
}

async function createAWSConfig() {
	const defaultProfile = vscode.workspace.getConfiguration().get("vscode-kms.awsProfile", undefined);
	var selectedProfile;

	if (!defaultProfile) {
		var awsCredentials = ini.parse(fs.readFileSync(getAWSCredentialsDefaultFilePath(), 'utf-8'));
		selectedProfile = await Window.showQuickPick(Object.keys(awsCredentials), {
			placeHolder: 'Input the AWS profile to use. Leave empty to use your default credentials'
		});
	}

	var credentials = new AWS.SharedIniFileCredentials({
		profile: defaultProfile | selectedProfile
	});
	var config = new AWS.Config({ credentials: credentials });
	if (config.region == undefined) config.region = vscode.workspace.getConfiguration().get("vscode-kms.defaultRegion", undefined);
	return config;
}

function getAWSCredentialsDefaultFilePath() {
	return path.join(
		getHomeDir(),
		'.aws',
		'credentials'
	);
}

function getHomeDir() {
	var env = process.env;
	var home = env.HOME ||
		env.USERPROFILE ||
		(env.HOMEPATH ? ((env.HOMEDRIVE || 'C:/') + env.HOMEPATH) : null);

	if (home) {
		return home;
	}

	if (typeof os.homedir === 'function') {
		return os.homedir();
	}

	vscode.window.showErrorMessage('Cannot load credentials, HOME path not set');
}

function emptySelection(ranges: vscode.Range[]) {
	return ranges.length === 1 && ranges[0].isEmpty;
}

function selectAll(doc: vscode.TextDocument) {
	return doc.validateRange(new Range(0, 0, Infinity, Infinity));
}

function decrypt(config: AWS.Config) {
	const editor = Window.activeTextEditor;
	if (editor == undefined) {
		vscode.window.showErrorMessage('No active window')
		return;
	}

	const doc = editor.document;
	var kms = new AWS.KMS(config);

	let ranges = editor.selections.map((s) => new Range(s.start, s.end));
	if (emptySelection(ranges)) {
		ranges = [selectAll(doc)];
	}

	ranges.forEach((range) => {
		kms.decrypt({
			CiphertextBlob: Buffer.from(doc.getText(range), 'base64'),
			EncryptionContext: {
				k8s_stack: 'secrets'
			}
		}, (err, data) => {
			if (err) {
				console.error(err, err.stack);
				vscode.window.showErrorMessage('An error occurred when running the decrypt command');
			} else {
				editor.edit(function (edit) {
					edit.replace(range, Buffer.from(data.Plaintext, 'base64').toString());
				})
			}
		})
	});
}

// this method is called when your extension is deactivated
export function deactivate() { }
