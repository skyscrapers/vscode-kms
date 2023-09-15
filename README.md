# vscode-kms

VS Code extension to encrypt and decrypt secrets using AWS KMS.

## Features

To encrypt something, simply select the text you want to encrypt, and then call the `KMS Encrypt` in the command palette. You'll be prompted for the AWS profile, the encryption context and the KMS key id to use.

The decryption operation works similarly, just select the encrypted text and call the `KMS Decrypt` command. You'll be prompted for the AWS profile and the encryption context to use.

## Requirements

You'll need your AWS credentials correctly configured in your system as if it were the AWS CLI.

## Installation

This extension is available in the VSCode Extensions Marketplace, [here](https://marketplace.visualstudio.com/items?itemName=skyscrapers-engineering.vscode-kms).

## Extension Settings

This extension contributes the following settings:

* `vscode-kms.awsProfile`: Profile to use from the AWS local credentials or config file. Will ask on every operation if not set.
* `vscode-kms.defaultEncryptionContext`: Default KMS encryption to use for encrypting, e.g. foo=bar

## Known Issues

--

## TODO

* [ ] Add some caching mechanism for profiles and encryption contexts
* [ ] Add progress bar message

## Release Notes

See the [releases page](https://github.com/skyscrapers/vscode-kms/releases).

## Development

### Local development

If you want to make changes to to this module you can check out the source code locally and run the extention in VSCode by opening the repo in VSCode, running `npm install` and Pressing F5 or launching it from the `Run and Debug` menu on the left side.

Valuable output is reported in the `OUTPUT` and `DEBUG CONSOLE` at the bottom.

More info: <https://code.visualstudio.com/api/working-with-extensions/testing-extension#debugging-the-tests>

### Publising

Once the extention is tested and ready to export you need to run the following commands:

```bash
$ cd vscode-kms
$ npm install -g @vscode/vsce
$ vsce package
# vscode-kms.vsix generated
$ vsce publish
# skyscrapers.vscode-kms published to VS Code Marketplace
```

The publish command requires a token which you can find in [this portal](https://dev.azure.com/Skyscrapers/_usersSettings/tokens).

After its published you can

More info: <https://code.visualstudio.com/api/working-with-extensions/publishing-extension>
