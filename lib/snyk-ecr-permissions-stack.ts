import * as cdk from 'aws-cdk-lib';
import {
  aws_iam,
  aws_ssm,
  RemovalPolicy,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Effect } from 'aws-cdk-lib/aws-iam';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

export class SnykEcrPermissionsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const snykExternalId = StringParameter.valueForTypedStringParameterV2(this, '/snyk/external/id', aws_ssm.ParameterValueType.STRING, 1);

    const snykServiceRole = new aws_iam.Role(this, 'SnykServiceRole', {
      description: 'Provides Snyk with read-only access to AWS EC2 Container Registry repositories',
      roleName: 'SnykServiceRole',
      assumedBy: new aws_iam.ArnPrincipal('arn:aws:iam::[Snyk ECR integration user id]:user/ecr-integration-user'),
    });
    snykServiceRole.applyRemovalPolicy(RemovalPolicy.DESTROY);

    snykServiceRole.addToPolicy(new aws_iam.PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['sts:AssumeRole'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'sts:ExternalId': snykExternalId,
        },
      },
    }));
    snykServiceRole.applyRemovalPolicy(RemovalPolicy.DESTROY);

    snykServiceRole.addToPolicy(new aws_iam.PolicyStatement({
      sid: 'SnykAllowPull',
      effect: Effect.ALLOW,
      actions: [
        'ecr:GetLifecyclePolicyPreview',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:DescribeImages',
        'ecr:GetAuthorizationToken',
        'ecr:DescribeRepositories',
        'ecr:ListTagsForResource',
        'ecr:ListImages',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetRepositoryPolicy',
        'ecr:GetLifecyclePolicy',
      ],
      resources: ['*'],
    }));
    snykServiceRole.applyRemovalPolicy(RemovalPolicy.DESTROY);
  }
}
