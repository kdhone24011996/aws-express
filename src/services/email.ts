import awsEmailService from "../email/AWSEmail";

import { generateRandomDigits } from "../util/common";
import { IUser } from "../models/User";
import { userService } from "./user";

import {
  EMAIL_CODE_EXPIRY_HOURS,
  EMAIL_CODE_LENGTH,
  EMAIL_CODE_RESEND_WAIT_MIN,
  EMAIL_CODE_RETRIES,
  EMAIL_SENDER,
} from "../util/secrets";
import cons = require("consolidate");

export class EmailService {
  sender: string;
  codeExpiryHours: number;
  resendWaitMin: number;
  codeLength: number;

  codeRetries: number;

  constructor(
    sender: string,
    codeExpiryHours = 24,
    resendWaitMin = 3,
    codeLength = 5,
    codeRetries = 3
  ) {
    this.sender = sender;
    this.codeExpiryHours = codeExpiryHours;
    this.resendWaitMin = resendWaitMin;
    this.codeLength = codeLength;
    this.codeRetries = codeRetries;
  }

  private getCodeExpiry(refDate?: Date) {
    const now = refDate ? refDate : new Date();
    let codeExpiryTime = now.getTime();
    codeExpiryTime += this.codeExpiryHours * 60 * 60 * 1000;
    const codeExpiry = new Date(codeExpiryTime);
    return codeExpiry;
  }

  private getResendWaitingMiliseconds() {
    return this.resendWaitMin * 60 * 1000;
  }

  private getWaitForDate(from: Date) {
    const waitForTime = from.getTime() + this.getResendWaitingMiliseconds();
    const waitFor = new Date(waitForTime);
    return waitFor;
  }

  public async sendVerificationCode(email: string) {
    const users = await userService.find({ email: email });
    if (users.data.length === 0) {
      throw new Error(
        `user with email ${email} not found. first register then send code.`
      );
    }

    const user = users.data[0];
    const now = new Date();

    if (user.verfication?.verified === true) {
      throw new Error(`user with email ${email} is already verified`);
    }

    let codeSendCount = user.verfication?.codeSendCount || 0;

    if (codeSendCount >= this.codeRetries) {
      const lastCodeSend = new Date(user.verfication?.lastCodeSend);
      const waitFor = this.getWaitForDate(lastCodeSend);
      if (now < waitFor) {
        throw new Error(
          `Wait till ${waitFor.toISOString()} to resend verification email. Retry count: ${codeSendCount}`
        );
      }
      codeSendCount = 0;
    }

    const to = email;
    const from = this.sender;
    const subject = "Verification";
    const code = generateRandomDigits(this.codeLength);
    const body = `<h3>Welcome to Econut!!</h3> <p>Your verification code is <code>${code}</code></p>`;
    const resultEmail = await awsEmailService.send(from, to, subject, body);

    const codeExpiryDate = this.getCodeExpiry(now);

    codeSendCount += 1;
    const update: Partial<IUser> = {
      verfication: {
        code: code.toString(),
        codeExpiryDate: codeExpiryDate,
        lastCodeSend: now,
        codeSendCount: codeSendCount,
      },
    };
    const userId = user._id;
    const result = await userService.update(userId, update);

    return result;
  }

  public async sendForgotEmail(email: string, userId: string, code: number) {
    const globalUrl = `https://localhost:3000/forgot-password?userId=${userId}&code=${code}`;
    const to = email;
    const from = this.sender;
    const subject = "Forgot";
    //const body = `<h3>No need to worry. We all forget :)</h3> <p>Your password reset code is <code>${code}</code></p>`;
    const body = `<h3>No need to worry. We all forget :)</h3><p>Excitedly yours</p> <p>The Econut Team</p> <p><small><a href=${globalUrl}>Click here to reset your password!</a> </small></p>`;
    const resultEmail = await awsEmailService.send(from, to, subject, body);
    return resultEmail;
  }
  public async sendRefundRequestNotification(
    email: string,
    cancelOrderId: string
  ) {
    const to = this.sender;
    const from = email;
    const subject = "Refund Request";
    //const body = `<h3>No need to worry. We all forget :)</h3> <p>Your password reset code is <code>${code}</code></p>`;
    const localUrl = `http://localhost:3000/api/v1/order/cancel/${cancelOrderId}`;
    const bodyToAdmin = `You have recieved a new refund request<br/><a href=${localUrl}>click to see it</a>`;
    const bodyToCustomer = `We have recived your refund request`;
    const resultEmail = await awsEmailService.send(
      from,
      from,
      subject,
      bodyToAdmin
    );
    const resultEmail2 = await awsEmailService.send(
      from,
      to,
      subject,
      bodyToCustomer
    );
    return resultEmail;
  }
  public async sendRefundApprovedNotification(email: string, orderId: string) {
    const to = this.sender;
    const from = email;
    const subject = "Refund Request Approved";
    //const body = `<h3>No need to worry. We all forget :)</h3> <p>Your password reset code is <code>${code}</code></p>`;
    const bodyToAdmin = `You have approved the refund for the order with order-id ${orderId}`;
    const bodyToCustomer = `We have approved the refund for the order with order-id ${orderId} <br/> You will get refund very soon`;
    const resultEmail = await awsEmailService.send(
      from,
      from,
      subject,
      bodyToAdmin
    );
    const resultEmail2 = await awsEmailService.send(
      from,
      to,
      subject,
      bodyToCustomer
    );
    return resultEmail;
  }
  public async sendRefundRejectedNotification(email: string, orderId: string) {
    const to = this.sender;
    const from = email;
    const subject = "Refund Request Approved";
    //const body = `<h3>No need to worry. We all forget :)</h3> <p>Your password reset code is <code>${code}</code></p>`;
    const bodyToAdmin = `You have rejected the refund request for the order with order-id ${orderId}`;
    const bodyToCustomer = `We have rejected the refund request for the order with order-id ${orderId}`;
    const resultEmail = await awsEmailService.send(
      from,
      from,
      subject,
      bodyToAdmin
    );
    const resultEmail2 = await awsEmailService.send(
      from,
      to,
      subject,
      bodyToCustomer
    );
    return resultEmail;
  }

  // public async sendWelcomeEmail(email: string) {
  //   console.log("Type of Email Recieved : ", typeof email);

  //   const localUrl = "http://localhost:3000/unsubscribe";
  //   const globalUrl = "https://www.sqor.io/unsubscribe";

  //   const to = email;
  //   const from = this.sender;
  //   const subject = "Welcome to SQOR!";
  //   const body = `<p>Hi There,</p> <p>Thanks for registering for early access to SQOR. We are super excited to have you on the list. We will update you as soon as we launch, so stay tuned!</p> <h4>SQOR is leveling the playing field in venture financing! It's time for a venture funding ecosystem that is data driven!</h4> <p>Excitedly yours,</p> <p>The SQOR Team</p> <p><small><a href=${globalUrl}>Unsubscribe!</a> </small></p>`;
  //   const resultEmail = await awsEmailService.send(from, to, subject, body);
  //   console.log("Result of Email : ", resultEmail);
  //   return resultEmail;
  // }

  // public async sendSignupEmailNotification(payload: Record<string, string>) {
  //   // const globalUrl = "https://www.sqor.io/invite?email=" + encodeURIComponent(email);
  //   const { email, firstName, lastName } = payload;
  //   const to = "laz@sqor.io";
  //   const from = this.sender;
  //   const subject = "New user signup to SQOR!";
  //   const body = `<p>Name: ${firstName} ${lastName}</p> <p>Email: ${email} </p>`;
  //   const resultEmail = await awsEmailService.send(from, to, subject, body);
  //   console.log("Result of Email : ", resultEmail);
  //   return resultEmail;
  // }
}

const emailService = new EmailService(
  EMAIL_SENDER,
  EMAIL_CODE_EXPIRY_HOURS,
  EMAIL_CODE_RESEND_WAIT_MIN,
  EMAIL_CODE_LENGTH,
  EMAIL_CODE_RETRIES
);

export default emailService;
