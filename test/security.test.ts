import {
  Template,
  Match,
} from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { SnykEcrPermissionsStack } from '../lib/snyk-ecr-permissions-stack';

const mutationPermissions = [
  'iam:DeleteRole',
  'iam:ChangePassword',
  'iam:CreateUser',
  'iam:CreateRole',
  'iam:AddRoleToInstanceProfile',
  'iam:AttachRolePolicy',
  'iam:AttachUserPolicy',
  'iam:AttachGroupPolicy',
  'iam:UpdateGroup',
  'iam:RemoveUserFromGroup',
];

describe('IAM tests', () => {
  const app = new cdk.App();
  const snykEcrPermissionsStack = new SnykEcrPermissionsStack(app, 'MyTestStack');
  const assert = Template.fromJSON(app.synth().getStackArtifact(snykEcrPermissionsStack.artifactId).template);

  describe('IAM mutation', () => {
    mutationPermissions.forEach((permission) => {
      test(`Does not have any IAM policy statements including ${permission}`, () => {
        const arrayMatches = assert.findResources('AWS::IAM::Policy', {
          Properties: {
            PolicyDocument: {
              Statement: Match.arrayWith([Match.objectLike({
                Action: permission,
                Effect: 'Allow',
              })]),
            },
          },
        });
        expect(Object.keys(arrayMatches).length).toBe(0);

        const directMatches = assert.findResources('AWS::IAM::Policy', {
          PolicyDocument: {
            Statement: Match.arrayWith([Match.objectLike({
              Action: permission,
              Effect: 'Allow',
            })]),
          },
        });
        expect(Object.keys(directMatches).length).toBe(0);
      });
    });
  });
});
