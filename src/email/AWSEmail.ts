import { SES } from "../config/aws";

import { EmailI } from "./Email";

export class AWSEmailService implements EmailI {
  async send(
    from: string,
    to: string,
    subject: string,
    message: string
  ): Promise<any> {
    const params = {
      Destination: {
        /* required */ CcAddresses: [to],
        ToAddresses: [to],
      },
      Message: {
        /* required */
        Body: {
          /* required */
          Html: {
            Charset: "UTF-8",
            Data: message,
          },
          Text: {
            Charset: "UTF-8",
            Data: message,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: subject,
        },
      },
      Source: from /* required */,
      SourceArn: `arn:aws:ses:ap-south-1:191084652312:identity/includ.tech@gmail.com`,
      ReturnPathArn: `arn:aws:ses:ap-south-1:191084652312:identity/includ.tech@gmail.com`,
      ReplyToAddresses: [
        from,
        /* more items */
      ],
    };

    const result = await SES.sendEmail(params).promise();
    return result;
  }
}

const awsEmailService = new AWSEmailService();

export default awsEmailService;
