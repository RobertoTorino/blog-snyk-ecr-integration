import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { SnykEcrPermissionsStack } from '../lib/snyk-ecr-permissions-stack';

const app = new cdk.App();
test('Matches SnapShot', () => {
  const stack = new cdk.Stack(app, 'TestStack');
  new SnykEcrPermissionsStack(stack, 'TestFunction', {
    terminationProtection: false,
    analyticsReporting: true,
  });
  const testStackOutput = app.synth().getStackArtifact('TestStack').template;

  expect(Template.fromJSON(testStackOutput)).toMatchSnapshot();
});
