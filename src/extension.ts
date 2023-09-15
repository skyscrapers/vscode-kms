// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as KMS from "@aws-sdk/client-kms";
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';


export let outputChannel = vscode.window.createOutputChannel('VSCode KMS');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	outputChannel.appendLine('"vscode-kms" is now active!');

	context.subscriptions.push(vscode.commands.registerCommand('extension.kmsdecrypt', decrypt));
	context.subscriptions.push(vscode.commands.registerCommand('extension.kmsencrypt', encrypt));
}

async function createKmsClient(): Promise<KMS.KMSClient | undefined> {
	const defaultProfile = vscode.workspace.getConfiguration().get("vscode-kms.awsProfile", undefined);
	var selectedProfile: string | undefined;

	if (!defaultProfile) {
		var awsProfiles = [];
		var awsCredentialsFilePath = getAWSCredentialsDefaultFilePath();
		if (fs.existsSync(awsCredentialsFilePath)) {
			awsProfiles = awsProfiles.concat(Object.keys(ini.parse(fs.readFileSync(awsCredentialsFilePath, 'utf-8'))));
		}

		var awsConfigFilePath = getAWSConfigDefaultFilePath();
		if (fs.existsSync(awsConfigFilePath)) {
			awsProfiles = awsProfiles.concat(Object.keys(ini.parse(fs.readFileSync(awsConfigFilePath, 'utf-8'))).map(function (profile) {
				return profile.replace(/^profile /i, ''); // In the aws config file, profiles are prefixed with "profile "
			}));
		}

		// Show all the available profiles from both config and credentials files
		selectedProfile = await vscode.window.showQuickPick(awsProfiles, {
			placeHolder: 'Input the AWS profile to use. Leave empty to use your default credentials'
		});

		if (selectedProfile === undefined) {
			return undefined;
		}
	}

	process.env.AWS_PROFILE = defaultProfile || selectedProfile;
	process.env.AWS_SDK_LOAD_CONFIG = '1';
	return new KMS.KMSClient();
}

function getAWSCredentialsDefaultFilePath() {
	var homeDir = getHomeDir() || "";
	return path.join(homeDir, '.aws', 'credentials');
}

function getAWSConfigDefaultFilePath() {
	var homeDir = getHomeDir() || "";
	return path.join(homeDir, '.aws', 'config');
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


async function askEncryptionContext(): Promise<KMS.EncryptRequest["EncryptionContext"] | undefined> {
	var encryptionContextRaw = await vscode.window.showInputBox({
		placeHolder: 'Encryption context: key=value',
		prompt: 'Input the encryption context to use. Leave empty to not use any encryption context. Press ESC to cancel the operation.',
		validateInput: value => {
			if (value.length > 0 && value.split('=').length !== 2) {
				return 'Encryption context must follow the format "key=value"';
			}
			return null;
		},
		ignoreFocusOut: true,
		value: vscode.workspace.getConfiguration().get("vscode-kms.defaultEncryptionContext", undefined)
	});

	if (encryptionContextRaw === undefined) {
		return undefined;
	}

	var encryptionContext: KMS.EncryptRequest["EncryptionContext"] = {};

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
		},
		ignoreFocusOut: true
	});
}

function decryptRange(range: vscode.Range, kmsClient: KMS.KMSClient, doc: vscode.TextDocument, encryptionContext: KMS.EncryptRequest["EncryptionContext"]): Promise<[vscode.Range, KMS.DecryptResponse]> {
	return new Promise((resolve, reject) => {
		const command = new KMS.DecryptCommand({
			CiphertextBlob: Buffer.from(doc.getText(range), 'base64'),
			EncryptionContext: encryptionContext
		});
		kmsClient.send(command, (err, data) => {
			if (err) {
				outputChannel.appendLine('ERROR: ' + err);
				reject(err);
			} else {
				resolve([range, data]);
			}
		});
	});
}

function encryptRange(range: vscode.Range, kmsClient: KMS.KMSClient, doc: vscode.TextDocument, encryptionContext: KMS.EncryptRequest["EncryptionContext"], kmsKeyId: string): Promise<[vscode.Range, KMS.EncryptResponse]> {
	return new Promise((resolve, reject) => {
		const command = new KMS.EncryptCommand({
			Plaintext: Buffer.from(doc.getText(range)),
			EncryptionContext: encryptionContext,
			KeyId: kmsKeyId
		});
		kmsClient.send(command, (err, data) => {
			if (err) {
				outputChannel.appendLine('ERROR: ' + err);
				reject(err);
			} else {
				resolve([range, data]);
			}
		});
	});
}

async function decrypt() {
	const editor = vscode.window.activeTextEditor;
	if (editor === undefined) {
		vscode.window.showErrorMessage('No active window');
		return;
	}

	var kmsClient = await createKmsClient();

	if (kmsClient === undefined) {
		outputChannel.appendLine('Decrypt operation cancelled');
		return;
	}

	var encryptionContext = await askEncryptionContext();

	if (encryptionContext === undefined) {
		outputChannel.appendLine('Decrypt operation cancelled');
		return;
	}

	const doc = editor.document;

	let ranges = editor.selections.map((s) => new vscode.Range(s.start, s.end));
	if (emptySelection(ranges)) {
		ranges = [selectAll(doc)];
	}

	Promise.all(ranges.map((range) => {
		return decryptRange(range, kmsClient, doc, encryptionContext);
	})).then((data) => {
		editor.edit((edit) => {
			data.forEach(([range, decryptedData]) => {
				decryptedData && decryptedData.Plaintext && edit.replace(range, Buffer.from(decryptedData.Plaintext).toString());
			});
		});
	}).catch((reason) => {
		vscode.window.showErrorMessage('An error occurred when running the decrypt command');
	});
}

async function encrypt() {
	const editor = vscode.window.activeTextEditor;
	if (editor === undefined) {
		vscode.window.showErrorMessage('No active window');
		return;
	}

	var kmsClient = await createKmsClient();

	if (kmsClient === undefined) {
		outputChannel.appendLine('Encrypt operation cancelled');
		return;
	}

	var encryptionContext = await askEncryptionContext();

	if (encryptionContext === undefined) {
		outputChannel.appendLine('Encrypt operation cancelled');
		return;
	}

	const kmsKeyId = await askKmsKeyId();

	if (kmsKeyId === undefined) {
		outputChannel.appendLine('Encrypt operation cancelled');
		return;
	}

	const doc = editor.document;

	let ranges = editor.selections.map((s) => new vscode.Range(s.start, s.end));
	if (emptySelection(ranges)) {
		ranges = [selectAll(doc)];
	}

	Promise.all(ranges.map((range) => {
		return encryptRange(range, kmsClient, doc, encryptionContext, kmsKeyId);
	})).then((data) => {
		editor.edit((edit) => {
			data.forEach(([range, encryptedData]) => {
				encryptedData && encryptedData.CiphertextBlob && edit.replace(range, Buffer.from(encryptedData.CiphertextBlob).toString('base64'));
			});
		});
	}).catch((reason) => {
		vscode.window.showErrorMessage('An error occurred when running the encrypt command');
	});
}

// this method is called when your extension is deactivated
export function deactivate() { }
