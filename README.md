# vscode-kms README

VS Code extension to encrypt and decrypt secrets using AWS KMS.

## Features

To encrypt something, simply select the text you want to encrypt, and then call the `KMS Encrypt` in the command palette. You'll be prompted for the AWS profile, the encryption context and the KMS key id to use.

The decryption operation works similarly, just select the encrypted text and call the `KMS Decrypt` command. You'll be prompted for the AWS profile and the encryption context to use.

## Requirements

You'll need your AWS credentials correctly configured in your system as if it were the AWS CLI.

## Extension Settings

This extension contributes the following settings:

* `vscode-kms.defaultRegion`: Default AWS region to use. This will only be used if there is no system default.
* `vscode-kms.awsProfile`: Profile to use from the AWS local credentials file. Will ask on every operation if not set.

## Known Issues

--

## Release Notes

### 0.1.0

Initial release.
