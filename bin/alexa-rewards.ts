#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { AlexaRewardsStack } from '../lib/alexa-rewards-stack';

const app = new cdk.App();

const alexaStack = new AlexaRewardsStack(app, 'AlexaRewardsStack');

