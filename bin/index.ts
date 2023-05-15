#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Tags } from 'aws-cdk-lib';
import { SnykEcrPipelineStack } from '../lib/snyk-ecr-pipeline-stack';

const app = new cdk.App();
export const application = 'SnykEcr';
export const env = {
  account: process.env.CDK_SYNTH_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_SYNTH_REGION || process.env.CDK_DEFAULT_REGION,
};

export const snykEcrPipelineStack = new SnykEcrPipelineStack(app, 'SnykEcrPipelineStack', {
  terminationProtection: false,
  analyticsReporting: true,
  stackName: 'SnykEcrPermissionsStack',
  description: 'Pipeline stack for a policy to give Snyk ecr permissions',
  env,
});
Tags.of(snykEcrPipelineStack).add('stage', 'prod');
Tags.of(snykEcrPipelineStack).add('app', 'snyk-policy');

// Show the actual AWS account id and region
console.log(`\x1B[1;34mAWS REGION: ${env.region}`);
console.log(`\x1B[1;34mAWS ACCOUNT-ID: ${env.account}`);

const { exec } = require('child_process');

exec(
  'aws iam list-account-aliases --query AccountAliases --output text || exit',
  (
    error: { message: any; },
    stdout: any,
  ) => {
    (`${stdout.trimEnd}`);
    const myAccountAlias = (`${stdout.trimEnd()}`);
    console.log(`\x1B[1;34MAWS ACCOUNT-ALIAS: ${myAccountAlias.toUpperCase()}`);

    exec(
      'aws codestar-connections list-connections --query "Connections[].ConnectionArn" --output text',
      (
        error: { message: any; },
        stdout: any,
      ) => {
        (`${stdout.trimEnd}`);
        const myCodeStarArn = (`${stdout.trimEnd()}`);
        console.log(`\x1B[1;34mAWS CODESTAR-ARN: ${myCodeStarArn}`);
      },
    );

    exec(
      'git config --get remote.origin.url | sed \'s/.*\\/\\([^ ]*\\/[^.]*\\).*/\\1/\'\n',
      (
        error: { message: any; },
        stdout: any,
      ) => {
        (`${stdout.trimEnd}`);
        const myBranch = (`${stdout.trimEnd()}`);
        console.log(`CURRENT BRANCH: ${myBranch}`);
      },
    );
  },
);
