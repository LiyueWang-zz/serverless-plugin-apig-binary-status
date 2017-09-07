# serverless-plugin-apig-binary-status

[Serverless framework](https://www.serverless.com) plugin to check binary enabled for API Gateway.
This plugin is only for internal project purpose. 

## Installation

Install to the Serverless project via npm

```bash
$ npm install --save serverless-plugin-apig-binary-status
```

## Usage

Add the plugin to your `serverless.yml`

```yaml
# serverless.yml

plugins:
  - serverless-plugin-apig-binary-status

functions:
  myfunction:
    checkBinaryStatus: true
```
