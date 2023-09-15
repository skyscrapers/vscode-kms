# Change Log

All notable changes to the "vscode-kms" extension will be documented in this file.

## 0.3.0

The extention is updated to be compatible with `source_profile` in the `~/.aws/config` file. This was done by upgrading to the newer V3 of the AWS sdk.

We exposed a new setting called `defaultEncryptionContext` where you can configure a default context key-value if you happen to use the same value a lot.
We removed the `defaultRegion` as we now rely on the region set in the `~/.aws/config` file.

We configured the encryption key to remain open when changing windows ( e.g. switch windows to copy the id of the KMS key).

## 0.2.0

The extension now also loads all the AWS profiles configured in the AWS CLI config file.

## 0.1.3

- Initial release
