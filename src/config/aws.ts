import {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
} from "../util/secrets";
import logger from "../util/logger";

import AWS from "aws-sdk";

AWS.config.update({
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
  region: AWS_REGION,
});

AWS.config.getCredentials((err) => {
  if (err) {
    console.log("AWS error: ", err);
    return;
  }

  logger.debug(
    `AWS ACCESS KEY ${AWS.config.credentials.accessKeyId.substr(0, 10)}...`
  );
  logger.info(`AWS REGION ${AWS.config.region}`);
});

export const s3 = new AWS.S3();
export const SES = new AWS.SES();
