import * as cdk from 'aws-cdk-lib';
import {
  aws_codebuild,
  aws_codestarnotifications,
  aws_iam,
  aws_sns,
  aws_sns_subscriptions,
  aws_ssm,
  Duration,
  pipelines,
  RemovalPolicy,
  Tags,
} from 'aws-cdk-lib';
import {
  BuildEnvironmentVariableType,
  BuildSpec,
} from 'aws-cdk-lib/aws-codebuild';
import { Construct } from 'constructs';
import { CodePipelineSource } from 'aws-cdk-lib/pipelines';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import {
  LoggingLevel,
  SlackChannelConfiguration,
} from 'aws-cdk-lib/aws-chatbot';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { PipelineNotificationEvents } from 'aws-cdk-lib/aws-codepipeline';
import { SubscriptionProtocol } from 'aws-cdk-lib/aws-sns';
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

    const chatBotSubscriptionEndpoint = aws_ssm.StringParameter.valueForStringParameter(this, '/chatbot/subscription/endpoint');

    const chatBotPipelineSnsTopic = new aws_sns.Topic(this, 'ChatbotPipelineSnsTopic', {});
    chatBotPipelineSnsTopic.applyRemovalPolicy(RemovalPolicy.DESTROY);
    chatBotPipelineSnsTopic.addSubscription(new aws_sns_subscriptions.UrlSubscription(chatBotSubscriptionEndpoint, {
      protocol: SubscriptionProtocol.HTTPS,
    }));

    const sourceCode = CodePipelineSource.connection('RobertoTorino/blog-snyk-ecr-integration', 'main', {
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

    const slackChannelId = aws_ssm.StringParameter.valueForStringParameter(this, '/slackchannel/id');
    const slackWorkspaceId = aws_ssm.StringParameter.valueForStringParameter(this, '/slackworkspace/id');

    const slackChannelConfiguration = new SlackChannelConfiguration(this, 'SlackConfigurationPipeline', {
      slackChannelConfigurationName: 'SlackConfiguration',
      slackWorkspaceId,
      slackChannelId,
      logRetention: RetentionDays.FIVE_DAYS,
      loggingLevel: LoggingLevel.ERROR,
      notificationTopics: [chatBotPipelineSnsTopic],
    });
    slackChannelConfiguration.applyRemovalPolicy(RemovalPolicy.DESTROY);
    Tags.of(slackChannelConfiguration).add('log-group-region', 'us-east-1');

    pipeline.buildPipeline();

    // jestReportGroup.grantWrite(reportStep.grantPrincipal);
    //
    // aws_iam.Grant.addToPrincipal({
    //   grantee: reportStep.grantPrincipal,
    //   actions: ['codebuild:BatchPutCodeCoverages'],
    //   resourceArns: [jestReportGroup.reportGroupArn],
    // });

    const pipelineRule = pipeline.pipeline.notifyOn('PipelineEvents', slackChannelConfiguration, {
      notificationRuleName: `${application}DetectFailedPipelineExecutions`,
      enabled: true,
      events: [
        PipelineNotificationEvents.ACTION_EXECUTION_FAILED,
        PipelineNotificationEvents.ACTION_EXECUTION_CANCELED,
        PipelineNotificationEvents.MANUAL_APPROVAL_FAILED,
        PipelineNotificationEvents.MANUAL_APPROVAL_NEEDED,
        PipelineNotificationEvents.PIPELINE_EXECUTION_FAILED,
        PipelineNotificationEvents.PIPELINE_EXECUTION_CANCELED,
        PipelineNotificationEvents.STAGE_EXECUTION_CANCELED,
        PipelineNotificationEvents.STAGE_EXECUTION_FAILED,
      ],
      detailType: aws_codestarnotifications.DetailType.FULL,
    });
    pipelineRule.applyRemovalPolicy(RemovalPolicy.DESTROY);
  }
}
