// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as AWS from 'aws-sdk';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('"vscode-kms" is now active!');

	context.subscriptions.push(vscode.commands.registerCommand('extension.kmsdecrypt', async () => {
		decrypt();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('extension.kmsencrypt', async () => {
		encrypt();
	}));
}

async function createAWSConfig(): Promise<AWS.Config | undefined> {
	const defaultProfile = vscode.workspace.getConfiguration().get("vscode-kms.awsProfile", undefined);
	var selectedProfile;

	if (!defaultProfile) {
		var awsCredentials = ini.parse(fs.readFileSync(getAWSCredentialsDefaultFilePath(), 'utf-8'));
		selectedProfile = await vscode.window.showQuickPick(Object.keys(awsCredentials), {
			placeHolder: 'Input the AWS profile to use. Leave empty to use your default credentials'
		});

		if (selectedProfile === undefined) {
			return undefined;
		}
	}

	var credentials = new AWS.SharedIniFileCredentials({
		profile: defaultProfile || selectedProfile
	});
	var config = new AWS.Config({ credentials: credentials });
	if (config.region === undefined) {
		config.region = vscode.workspace.getConfiguration().get("vscode-kms.defaultRegion", undefined);
	}
	return config;
}

function getAWSCredentialsDefaultFilePath() {
	var homeDir = getHomeDir() || "";
	return path.join(
		homeDir,
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
	return doc.validateRange(new vscode.Range(0, 0, Infinity, Infinity));
}

async function askEncryptionContext(): Promise<AWS.KMS.EncryptionContextType | undefined> {
	var encryptionContextRaw = await vscode.window.showInputBox({
		placeHolder: 'Encryption context: key=value',
		prompt: 'Input the encryption context to use. Leave empty to not use any encryption context. Press ESC to cancel the operation.',
		validateInput: value => {
			if (value.length > 0 && value.split('=').length !== 2) {
				return 'Encryption context must follow the format "key=value"';
			}
			return null;
		}
	});

	if (encryptionContextRaw === undefined) {
		return undefined;
	}

	var encryptionContext: AWS.KMS.EncryptionContextType = {};

	if (encryptionContextRaw) {
		var e = encryptionContextRaw.split('=');
		encryptionContext[e[0]] = e[1];
	}

	return encryptionContext;
}

async function askKmsKeyId(): Promise<string | undefined> {
	return vscode.window.showInputBox({
		placeHolder: 'f12345aa-098e-456b-b1b2-876434a09876',
		prompt: 'Input the encryption key id or ARN to use. Press ESC to cancel the operation.',
		validateInput: value => {
			return value.length === 0 ? "Can't be empty" : null;
		}
	});
}

async function decrypt() {
	const editor = vscode.window.activeTextEditor;
	if (editor === undefined) {
		vscode.window.showErrorMessage('No active window');
		return;
	}

	var awsConfig = await createAWSConfig();

	if (awsConfig === undefined) {
		console.log('Decrypt operation cancelled');
		return;
	}

	var encryptionContext = await askEncryptionContext();

	if (encryptionContext === undefined) {
		console.log('Decrypt operation cancelled');
		return;
	}

	const doc = editor.document;
	var kms = new AWS.KMS(awsConfig);

	let ranges = editor.selections.map((s) => new vscode.Range(s.start, s.end));
	if (emptySelection(ranges)) {
		ranges = [selectAll(doc)];
	}

	ranges.forEach((range) => {
		kms.decrypt({
			CiphertextBlob: Buffer.from(doc.getText(range), 'base64'),
			EncryptionContext: encryptionContext
		}, (err, data) => {
			if (err) {
				console.error(err, err.stack);
				vscode.window.showErrorMessage('An error occurred when running the decrypt command');
			} else if (data && data.Plaintext) {
				editor.edit((edit) => {
					edit.replace(range, Buffer.from(data.Plaintext.toString(), 'base64').toString());
				});
			}
		});
	});
}

async function encrypt() {
	const editor = vscode.window.activeTextEditor;
	if (editor === undefined) {
		vscode.window.showErrorMessage('No active window');
		return;
	}

	var awsConfig = await createAWSConfig();

	if (awsConfig === undefined) {
		console.log('Decrypt operation cancelled');
		return;
	}

	var encryptionContext = await askEncryptionContext();

	if (encryptionContext === undefined) {
		console.log('Decrypt operation cancelled');
		return;
	}

	const kmsKeyId = await askKmsKeyId();

	if (kmsKeyId === undefined) {
		console.log('Decrypt operation cancelled');
		return;
	}

	const doc = editor.document;
	var kms = new AWS.KMS(awsConfig);

	let ranges = editor.selections.map((s) => new vscode.Range(s.start, s.end));
	if (emptySelection(ranges)) {
		ranges = [selectAll(doc)];
	}

	ranges.forEach((range) => {
		kms.encrypt({
			Plaintext: doc.getText(range),
			EncryptionContext: encryptionContext,
			KeyId: kmsKeyId
		}, (err, data) => {
			if (err) {
				console.error(err, err.stack);
				vscode.window.showErrorMessage('An error occurred when running the decrypt command');
			} else if (data.CiphertextBlob) {
				editor.edit((edit) => {
					edit.replace(range, data.CiphertextBlob.toString('base64'));
				});
			}
		});
	});
}

// this method is called when your extension is deactivated
export function deactivate() { }
