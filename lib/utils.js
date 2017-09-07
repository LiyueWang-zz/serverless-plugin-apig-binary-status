'use strict';
const BbPromise = require('bluebird');
const uuid = require('uuid');
const AttributesServiceClient = require('@d2l/attributes-client-node');

module.exports = {

    isContentHandlingEnabled(integrationResponse, contentHandling, apigateway) {
		return apigateway.getIntegrationResponse(integrationResponse)
				.promise()
				.then((data) => {
					if (data.statusCode === '200' && data.contentHandling && data.contentHandling === contentHandling) {
						return true;
					}
					else {
						return false;
					}
				});
	},

	checkBinaryMediaTypes(apigateway, restApiId) {
		const expectedType = "application/json";
		var params = {
			restApiId: restApiId
		};

		return apigateway.getRestApi(params)
				.promise()
				.then((data) => {
					if (data && data.binaryMediaTypes ) {
						return (data.binaryMediaTypes.indexOf(expectedType) > -1);
					}
					else {
						return false;
					}
				});
	},

	setCompressionForFunction(lambda, funcName, compression) {
		const params = {
			FunctionName: funcName,
  			Qualifier: "1"
		};

		return lambda.getFunctionConfiguration(params)
				.promise()
				.then((data) => {
					if (data && data.Environment && data.Environment.Variables) {
						return data.Environment.Variables;
					}
					else {
						return {};
					}
				})
				.then((variables) => {
					variables.ENABLE_COMPRESSION = compression;
					const environment = {
						FunctionName: funcName,
						Environment: {
							Variables: variables
						}
					};

					return lambda.updateFunctionConfiguration(environment)
							.promise();
				});

	},

	getApiGatewayResources(apigateway, apiName) {
		let restApiId;
		let resources ={};

		return apigateway.getRestApis()
				.promise()
				.then((apis) => {
					restApiId = apis.items.find(api => api.name === apiName).id;

					return apigateway
						.getResources({ restApiId: restApiId })
						.promise();
				})
				.then((res) => {
					resources.items = res.items;
					resources.restApiId = restApiId;
					return resources;
				});
	},

    waitTime(seconds){
		return new BbPromise(resolve => setTimeout(() => resolve(), seconds));
	},

	createTestData(stage) {
		const client = new AttributesServiceClient({
			stage: stage
		});

		const tenantId = "40000000-0000-0000-0000-00000000test";

		const definitionData = {
			name: "testfortemp",
			tenantId: tenantId,
			value: {
				type: "string"
			},
			applyTo: "user",
			required: false
		};

		const objectType = 'user';
		const objectId = '12340000';
		const valueData = {
			tenantId: tenantId,
			objectId: "12340000",
			objectType: "user",
			values: {
				"testfortemp": {
				    value: "valuefortemp"
				}
			}
		};

		return client.createDefinition(definitionData, { tenantId: tenantId })
		 .then(() => {
			 return client.setValues(objectType, objectId, valueData, { tenantId: tenantId });
		 })
		 .then(() => {
			 return true;
		 })
		 .catch(error => {
			console.log(error);
			return false;
		});
	},

	deleteTestData(stage){
		const client = new AttributesServiceClient({
			stage: stage
		});

		const tenantId = "40000000-0000-0000-0000-00000000test";
		const definitionId = 'testfortemp';

		const objectType = 'user';
		const objectId = '12340000';
		const valueData = {
			values: {
				"testfortemp": {
					value: "valuefortemp"
				}
			}
		};

        return client.removeValues(objectType, objectId, valueData, { tenantId: tenantId })
		 .then(() => {
			 return client.deleteDefinition(definitionId, { tenantId: tenantId });
		 })
		 .then(() => {
			 return true;
		 })
		 .catch(error => {
			console.log(error);
			return false;
		});
	},

	testBinaryEnabled(stage) {
		const client = new AttributesServiceClient({
			stage: stage
		});

		const rule1Id = uuid.v4();
		const filters = [{
			id: rule1Id,
			match: [{
				attr: 'testfortemp',
				op: '$ne',
				value: 'test'
			}]
		}];

		return client.filterValues(filters, {}, { tenantId: '40000000-0000-0000-0000-00000000test' })
		.then(body=>{
			return true;
		})
		.catch(error => {
			console.log(error);
			return false;
		});
	}
}
