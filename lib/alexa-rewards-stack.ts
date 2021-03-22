import * as cdk from '@aws-cdk/core';
import lambda = require('@aws-cdk/aws-lambda');
import assets = require('@aws-cdk/aws-s3-assets');
import dynamodb = require('@aws-cdk/aws-dynamodb');
import * as alexaAsk from '@aws-cdk/alexa-ask';
import { ServicePrincipal, Role, PolicyStatement, CompositePrincipal } from '@aws-cdk/aws-iam';
import { execSync } from 'child_process';
const path = require('path');
const alexaAssets = '../skill'

export class AlexaRewardsStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const asset = new assets.Asset(this, 'SkillAsset', {
      path: path.join(__dirname, alexaAssets),
    })

    //role to access bucket
    const role = new Role(this, 'Role', {
      assumedBy:new CompositePrincipal(
        new ServicePrincipal('alexa-appkit.amazon.com'),
        new ServicePrincipal('cloudformation.amazonaws.com')
      )
    });


    // Allow the skill resource to access the zipped skill package
    role.addToPolicy(new PolicyStatement({
      actions: ['S3:GetObject'],
      resources: [`arn:aws:s3:::${asset.s3BucketName}/${asset.s3ObjectKey}`]
    }));

    // DynamoDB Table
     const usersTable = new dynamodb.Table(this, 'Users', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Install Dependencies and Compile Lambda Function
    execSync('cd lambda-fns && npm i && npm run build');

    // Lambda function for Alexa fulfillment
    const alexaLambda = new lambda.Function(this, 'AlexaLambdaHandler', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset('lambda-fns'),
      handler: 'lambda.handler',
      environment: {
        USERS_TABLE: usersTable.tableName
      }
    });

    // grant the lambda role read/write permissions to our table
    usersTable.grantReadWriteData(alexaLambda);

    // create the skill
    const skill = new alexaAsk.CfnSkill(this, 'alexa-rewards', {
      vendorId: 'M1FIEV1ZI2IOFA',
      authenticationConfiguration: {
        clientId: 'amzn1.application-oa2-client.96bdd67ebee94f36bf045ceeefbd9769',
        clientSecret: 'e23b2cd127a6f2662767a876bcee6cef1d6e600f32cae3357a94da685e247ce9',
        refreshToken: 'Atza|IwEBIFJlMHaNGCru2CvJo09KVOre2iTPCfQhIEyOxepydR9Vbw6nFfTOLNZ4HmnPQ-diYKoA-eYR0NuJ0sCtw_BDorthqNtGj3ztai_gHwiJR8-l7wCEtgmWk2k9UIaf4IAreuBd8HKRmsyheINEpZzfbZTuexCW6do896cd2HCQXD6aqhFYYO8peKSIdCFEF6wye5bf5xPgiuwDaTEn5zTcW7Kxhi1zhZqqWAQkUt7SQZdXcvtYpkfovyC4rhH0GdLkXGgDgCZAnU8JknUaJYXfJ6nLWMQyPjEJ9ABz0X7LzWv-kgT48erRIpWNcBC0dCPz8SngVaLduL7f6kjqpNKX8gy0KYB4UofyQvI-dUxs8Alw1wzF4xJ1BQ-PeeVE7AAV94DQ0OoBAl2V8dkih-cvJWLzPlBF-_WGog3L9tgAp9NsFYcSudSbPsKC3PTXRuR-nBShtB14nxzTrJKIIzTNmg-R2XoCccbhAf8vIF-HZAS_n81ChxX7dExukN0Cw-qxxiKm_YnPWQjRWPiVKRAErvky68aPWEdFetO1FvoPRBlrFKdpMNL4k3gtf1KpzK6lxcaUbj_dWyvdUqpNYWN1kquy'
      },
      skillPackage:{
        s3Bucket: asset.s3BucketName,
        s3Key: asset.s3ObjectKey,
        s3BucketRole: role.roleArn,
        overrides : {
          manifest: {
            apis:{
              custom: {
                endpoint:{
                  uri: alexaLambda.functionArn
                }
              }
            }
          }
        }
      }
    })





  /*
    Allow the Alexa service to invoke the fulfillment Lambda.
    In order for the Skill to be created, the fulfillment Lambda
    must have a permission allowing Alexa to invoke it, this causes
    a circular dependency and requires the first deploy to allow all
    Alexa skills to invoke the lambda, subsequent deploys will work
    when specifying the eventSourceToken
  */
    alexaLambda.addPermission('AlexaPermission', {
      //eventSourceToken: skill.ref,
      principal: new ServicePrincipal('alexa-appkit.amazon.com'),
      action: 'lambda:InvokeFunction'
  });
  }
}
