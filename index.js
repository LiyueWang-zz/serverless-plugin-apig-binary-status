'use strict';
const BbPromise = require('bluebird');
const _ = require( 'lodash' );

module.exports = class ApiGatewayBinaryStatus {

	constructor(serverless, options) {
		this.serverless = serverless;
		this.options = options;
		this.provider = this.serverless.getProvider('aws');

		this.hooks = {
			'after:aws:deploy:finalize:cleanup': this.checkBinarySupportStatus.bind(this),
		};
	}

	checkBinarySupportStatus(){
		this.serverless.cli.log('[serverless-plugin-apig-binary-status] Checking binary support enabled to AWS API Gateway...');

		return BbPromise.bind(this)
			.then(this.testBinaryEnabled("Before"))
			.then(this.getFunctionsForContentHandling)
			.then(this.checkContentHandlingEnabled)
			.then(this.testBinaryEnabled("After"));
	}

	getFunctionsForContentHandling () {
		const funcs = this.serverless.service.functions;
		const validFuncs = {};

		Object.keys(funcs).forEach((fKey) => {
			funcs[fKey].events.forEach((e) => {
				if (e.http && e.http.contentHandling) {
					validFuncs[fKey] = funcs[fKey];
				}
			})
		});
		return validFuncs;
	}

	checkContentHandlingEnabled (funcs) {
		if (!Object.keys(funcs).length) {
			return;
		}
		const apiName = this.provider.naming.getApiGatewayName();

		const apigateway = new this.provider.sdk.APIGateway({
			region: this.options.region
		});

		const integrationResponse = {
			statusCode: '200'
		};

		const funcName = "attributes-dev-api"; //TODO
		let restApiId;

		let checkIfEnabled = (funcs) => {
			return apigateway.getRestApis()
					.promise()
					.then((apis) => {
						integrationResponse.restApiId = apis.items.find(api => api.name === apiName).id;
						restApiId = integrationResponse.restApiId;

						return apigateway
							.getResources({ restApiId: integrationResponse.restApiId })
							.promise();
					})
					.then((resources) => {
						const results = [];
						results.push(this.checkBinaryMediaTypes(apigateway, restApiId));
						_.mapKeys(funcs, (fValue, fKey)=>{
							_.map(fValue.events, e => {
								if (e.http && e.http.contentHandling) {
									integrationResponse.httpMethod = e.http.method.toUpperCase();
									integrationResponse.resourceId = resources.items.find(
									r => r.path === `/${e.http.path}`).id;
									results.push(this.isContentHandlingEnabled(integrationResponse, e.http.contentHandling, apigateway));
								}
							})
						})
						return Promise.all(results);
					})
					.then((results) => {
						const success = _.every( results, result => result );

						if( success ) {
							console.log("All contentHandling enabled, set env compression for lambda function...");
							this.setCompressionForFunction(funcName);
						} else {
							console.log("Some contentHandling not enabled");
							throw new Error("Some contentHandling not enabled");
						}
					})
					.catch(error =>{
						console.log(error);
						setTimeout( ()=>checkIfEnabled(funcs), 5000 );
					});
		};

		checkIfEnabled(funcs);
	}

	isContentHandlingEnabled (integrationResponse, contentHandling, apigateway) {
		return apigateway.getIntegrationResponse(integrationResponse)
				.promise()
				.then((data) => {
					// console.log("getIntegrationResponse data: "+JSON.stringify(data, null, 6))
					if (data.statusCode === '200' && data.contentHandling && data.contentHandling === contentHandling) {
						return true;
					}
					else {
						return false;
					}
				});
	}

	checkBinaryMediaTypes(apigateway, restApiId) {
		const expectedType = "application/json";
		var params = {
			restApiId: restApiId
		};

		return apigateway.getRestApi(params)
				.promise()
				.then((data) => {
					console.log("apigateway.getRestApi data: "+JSON.stringify(data, null, 6))
					if (data && data.binaryMediaTypes ) {
						const exist = data.binaryMediaTypes.indexOf(expectedType) > -1;
						return exist;
					}
					else {
						return false;
					}
				});
	}

	setCompressionForFunction (funcName) {
		console.log("setCompressionForFunction...");
		const lambda = new this.provider.sdk.Lambda({
			region: this.options.region
		});

		const params = {
			FunctionName: funcName, 
  			Qualifier: "1"
		};
		return lambda.getFunctionConfiguration(params)
				.promise()
				.then((data) => {
					console.log("lambda.getFunctionConfiguration data: "+JSON.stringify(data, null, 6));
					if (data && data.Environment && data.Environment.Variables) {
						return data.Environment.Variables;
					}
					else {
						return {};
					}
				})
				.then((variables) => {
					
					variables.ENABLE_COMPRESSION = true;
					console.log("variables: "+JSON.stringify(variables, null, 6))
					const environment = {
						FunctionName: funcName, 
						Environment: {
							Variables: variables
						}
					};

					return lambda.updateFunctionConfiguration(environment)
							.promise();
				});

	}

}
