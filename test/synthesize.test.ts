import { App } from 'aws-cdk-lib';
import { SnykEcrPermissionsStack } from '../lib/snyk-ecr-permissions-stack';

describe('Synthesize tests', () => {
  const app = new App();
  let stack: SnykEcrPermissionsStack;

  test('Creates the stack without exceptions', () => {
    expect(() => {
      stack = new SnykEcrPermissionsStack(app, 'TestStack', {
        terminationProtection: false,
      });
    }).not.toThrow();
  });

  test('This app can synthesize completely', () => {
    expect(() => {
      app.synth();
    }).not.toThrow();
  });
});
