import type { FastifyPluginAsync } from 'fastify';
import { sudoWebhook } from './sudo.js';
import { paystackWebhook } from './paystack.js';
import { flutterwaveWebhook } from './flutterwave.js';
import { wiseWebhook } from './wise.js';
import { currencycloudWebhook } from './currencycloud.js';
import { modulrWebhook } from './modulr.js';
import { dojahWebhook } from './dojah.js';

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  await sudoWebhook(app);
  await paystackWebhook(app);
  await flutterwaveWebhook(app);
  await wiseWebhook(app);
  await currencycloudWebhook(app);
  await modulrWebhook(app);
  await dojahWebhook(app);
};
