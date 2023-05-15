import * as cdk from 'aws-cdk-lib';
import {
  aws_codebuild,
  aws_iam,
  aws_ssm,
  Duration,
  pipelines,
  Tags,
} from 'aws-cdk-lib';
import {
  BuildEnvironmentVariableType,
  BuildSpec,
} from 'aws-cdk-lib/aws-codebuild';
import { Construct } from 'constructs';
import { CodePipelineSource } from 'aws-cdk-lib/pipelines';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { SnykEcrPermissionsStage } from './snyk-ecr-permissions-stage';
import { application } from '../bin';

export class SnykEcrPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    Tags.of(scope).add('stage', 'prod');
    Tags.of(scope).add('app', 'snyk-policy');

    const pipelineRole = new aws_iam.Role(this, 'PipelineRole', {
      roleName: `${application}PipelineRole`,
      assumedBy: new aws_iam.ServicePrincipal('codepipeline.amazonaws.com'),
      managedPolicies: [
        {
          managedPolicyArn: 'arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess',
        },
      ],
    });

    const codestarConnectionArn = StringParameter.valueForTypedStringParameterV2(this, '/codestar/connection/arn', aws_ssm.ParameterValueType.STRING, 1);

    const sourceCode = CodePipelineSource.connection('your-repository-name', 'main', {
      triggerOnPush: true,
      connectionArn: codestarConnectionArn,
      actionName: 'SnykEcrPermissions',
    });

    const codeBuildSynthAction = new pipelines.ShellStep('Synthesize', {
      input: sourceCode,
      primaryOutputDirectory: 'cdk.out',
      installCommands: [
        'npm cache clean -f',
        'rm package-lock.json',
        'rm -rvf node_modules',
        'npm i',
      ],
      commands: [
        'npm run build',
        'npm test -- -u',
        'npm audit --audit-level=critical',
        'npx cdk synth -q',
      ],
    });

    const codeBuildBuildEnvironment = {
      computeType: aws_codebuild.ComputeType.LARGE,
      buildImage: aws_codebuild.LinuxArmBuildImage.fromCodeBuildImageId('aws/codebuild/amazonlinux2-aarch64-standard:3.0'),
      privileged: true,
      environmentVariables: {
        SNYK_TOKEN: {
          type: BuildEnvironmentVariableType.SECRETS_MANAGER,
          value: 'your-snyk-api-key',
        },
      },
    };

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      crossAccountKeys: false,
      dockerEnabledForSelfMutation: false,
      dockerEnabledForSynth: false,
      enableKeyRotation: false,
      pipelineName: 'SnykEcrPipeline',
      publishAssetsInParallel: true,
      reuseCrossRegionSupportStacks: false,
      role: pipelineRole,
      selfMutation: true,
      useChangeSets: false,
      codeBuildDefaults: {
        buildEnvironment: codeBuildBuildEnvironment,
        timeout: Duration.minutes(60),
      },
      synth: codeBuildSynthAction,
    });

    const snykScanStep = new pipelines.CodeBuildStep('SnykScanStep', {
      input: sourceCode,
      commands: [
        'echo Start Snyk scan',
      ],
      partialBuildSpec: BuildSpec.fromObject({
        version: '0.2',
        env: {
          shell: 'bash',
          'git-credential-helper': 'no',
        },
        phases: {
          install: {
            'on-failure': 'ABORT',
            'runtime-versions': {
              nodejs: '18',
            },
            commands: [
              'rm package-lock.json',
              'rm -rvf node_modules',
            ],
          },
          build: {
            'on-failure': 'ABORT',
            commands: [
              'npm i',
              'npm i snyk@latest -g',
              'npm run build',
              'npx cdk synth -q',
            ],
          },
          post_build: {
            'on-failure': 'ABORT',
            commands: [
              'cp -Rfv .snyk cdk.out/.snyk',
              'snyk iac test --severity-threshold=high cdk.out',
              'snyk test --all-projects --severity-threshold=critical',
            ],
          },
        },
      }),
    });

    const snykEcrPermissionsStage = new SnykEcrPermissionsStage(this, 'SnykEcrPermissionsStage');
    pipeline.addStage(snykEcrPermissionsStage, {
      pre: [
        new pipelines.ConfirmPermissionsBroadening('Check', {
          stage: snykEcrPermissionsStage,
        }),
        snykScanStep,
      ],
    });
  }
}
