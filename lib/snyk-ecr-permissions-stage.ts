import * as cdk from 'aws-cdk-lib';
import { Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SnykEcrPermissionsStack } from './snyk-ecr-permissions-stack';
import {
  env,
} from '../bin';

export class SnykEcrPermissionsStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    const snykEcrPermissionsStack = new SnykEcrPermissionsStack(this, 'SnykEcrPermissionsStack', {
      terminationProtection: false,
      analyticsReporting: true,
      stackName: 'SnykEnableEcrPermissionsStack',
      description: 'Pipeline stack for a policy to give Snyk AWS ECR permissions',
      env,
    });
    Tags.of(snykEcrPermissionsStack).add('stage', 'prod');
    Tags.of(snykEcrPermissionsStack).add('app', 'snyk-policy');
  }
}
