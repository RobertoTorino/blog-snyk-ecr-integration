import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { SnykEcrPermissionsStack } from '../lib/snyk-ecr-permissions-stack';

describe('SnykEcrPermissionsStack', () => {
  test('test stack resources', () => {
    const app = new cdk.App();
    const env = {
      account: process.env.CDK_SYNTH_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_SYNTH_REGION || process.env.CDK_DEFAULT_REGION,
    };

    const snykEcrPermissionsStack = new SnykEcrPermissionsStack(app, 'EcrPipelineStack', { env });
    const template = Template.fromStack(snykEcrPermissionsStack);

    template.hasResourceProperties('AWS::IAM::Role', {});
    template.resourceCountIs('AWS::IAM::Role', 1);
    template.resourceCountIs('AWS::IAM::Policy', 1);
  });
});
