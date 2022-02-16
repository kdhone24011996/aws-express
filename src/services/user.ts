import { SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION } from "constants";
import { Model } from "mongoose";
import { Roles } from "../models/Roles";
import { generateToken, refreshToken, verifyToken } from "../util/jwt";
import {
  CodeKind,
  IAddress,
  ICodes,
  ITokens,
  Profile,
  TokenKind,
  User,
  UserDoc,
} from "../models/User";
import { IUser } from "../models/User";
import { DatabaseService } from "./database";
import emailService from "./email";
import { generateRandomDigits } from "../util/common";

export interface UserResponse {
  id: string;
  email: string;
}

export interface UserResetPasswordResponse {
  user: UserResponse;
  message: string;
}

export interface ITokenPayload {
  user: {
    id: string;
  };
}

export interface IMeResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Roles;
  phoneNumber: string;
  shippingAddresses: IAddress[];
}

class UserService extends DatabaseService<IUser, UserDoc> {
  constructor(model: Model<UserDoc>) {
    super(model);
  }

  public async findUserByEmail(email: string) {
    const result = await this.find({ email });
    if (result.data.length === 0) {
      throw Error(`User with email ${email} not found`);
    }
    return result.data[0];
  }

  public async findUserExistByEmail(email: string) {
    const result = await this.find({ email });
    if (result.data.length === 0) {
      return null;
    }
    return result.data[0];
  }

  public async signup(record: IUser) {
    const user = await this.create(record);
    const payload: ITokenPayload = {
      user: {
        id: user.id,
      },
    };

    const tokenResponse = await this.createToken(user, payload);

    const me = await this.me(user.id);

    return {
      user: me,
      auth: tokenResponse,
    };
  }
  public async login(email: string, password: string) {
    const user: UserDoc = await this.findUserExistByEmail(email);
    if (!user) {
      throw new Error(`user with email id ${email} does not exists`);
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      throw new Error("Invalid password");
    }

    const payload: ITokenPayload = {
      user: {
        id: user.id,
      },
    };

    const tokenResponse = await this.createToken(user, payload);

    const me = await this.me(user.id);

    return {
      user: me,
      auth: tokenResponse,
    };
  }

  async createToken(user: UserDoc, payload: ITokenPayload) {
    const tokenResponse = await generateToken(payload);
    const refreshToken: ITokens = {
      kind: TokenKind.REFRESH,
      status: true,
      token: tokenResponse.refreshToken,
      issued: new Date(),
    };
    // checking if the refresh token exist in user if yes then update it and if no then create

    const tokens = user.tokens || [];
    const idx = tokens.findIndex((token) => token.kind === TokenKind.REFRESH);
    if (idx !== -1) {
      tokens[idx] = refreshToken;
    } else {
      tokens.push(refreshToken);
    }

    const updateObj: Partial<IUser> = {
      tokens,
    };
    const updatedUser = await this.update(user.id, updateObj);
    return tokenResponse;
  }

  public async me(userId: string) {
    const user = await this.findById(userId);
    const response: IMeResponse = {
      id: user.id,
      email: user.email,
      firstName: user.profile.firstName,
      lastName: user.profile.lastName,
      role: user.profile.role,
      phoneNumber: user.profile.phoneNumber,
      shippingAddresses: user.profile.shippingAddresses,
    };
    return response;
  }
  public async refreshToken(token: string, refreshToken: string) {
    //get refresh payload and check if the refresh is true
    const refreshPayload: any = await verifyToken(refreshToken, true);
    if (refreshPayload.refresh !== true) {
      throw new Error("Invalid refresh token provided");
    }
    const payload: any = await verifyToken(token, true);
    const userId = payload.user?.id;
    const user = await this.findById(userId);

    const refreshTokens = user.tokens.filter((item) => {
      return item.kind === TokenKind.REFRESH;
    });
    if (refreshTokens.length === 0) {
      throw new Error("Refresh token not found");
    }
    const rfToken = refreshTokens[0];
    if (rfToken.token !== refreshToken) {
      throw new Error("refresh token does not match");
    }
    if (rfToken.status === false) {
      throw new Error("Refresh token access has been revoked");
    }
    const newPayload: ITokenPayload = {
      user: {
        id: user.id,
      },
    };

    const tokenResponse = await this.createToken(user, newPayload);
    return tokenResponse;
  }

  public async updateUserProfile(
    user: IMeResponse,
    requestBody: Partial<Profile>
  ) {
    const userData = await this.findById(user.id);
    const profile = userData.profile;
    const {
      firstName = profile.firstName,
      lastName = profile.lastName,
      gender = profile.gender,
      shippingAddresses = profile.shippingAddresses,
      phoneNumber = profile.phoneNumber,
    } = requestBody;

    const newProfile = {
      firstName,
      lastName,
      gender,
      shippingAddresses,
      phoneNumber,
      role: user.role,
    };

    const response = await this.update(user.id, { profile: newProfile });
    return response;
  }

  public async verify(email: string, code: string) {
    const users = await this.find({ email: email });
    if (users.data.length === 0) {
      throw new Error(`user with email ${email} not found`);
    }

    const user = users.data[0];

    if (!user.verfication || !user.verfication?.code) {
      throw new Error(`First send a verification email to the email ${email}`);
    }

    if (user.verfication?.verified === true) {
      throw new Error(`User with email ${email} is already verified`);
    }

    const vcode = user.verfication.code || "";

    if (vcode !== code) {
      throw new Error(`verification code '${code}' is invalid`);
    }

    const now = new Date();
    const codeExpiryDate = new Date(user.verfication?.codeExpiryDate);
    if (now > codeExpiryDate) {
      throw new Error(`code '${code}' has expired. resend verification email`);
    }

    const update: Partial<IUser> = {
      verfication: {
        verified: true,
        codeSendCount: 0,
        verificationDate: now,
      },
    };

    const result = await this.update(user._id, update);
    return result;
  }

  public async forgot(email: string) {
    const user = await this.findUserByEmail(email);
    // const codeResponse = await this.generateCode(user, CodeKind.FORGOT);
    // const emailRes = await emailService.sendForgotEmail(
    //   email,
    //   codeResponse.code.code
    // );
    // codeResponse.code.code = "<hidden>";
    // return codeResponse;

    if (!user) {
      throw new Error(`user with email ${email} is not found`);
    }
    const codeLength = 5;
    const code = generateRandomDigits(codeLength);
    const codeExpiryTimeInHour = 1;
    const forgotCodeObj: ICodes = {
      code: code,
      codeExpiryDate: new Date(
        Date.now() + codeExpiryTimeInHour * 1000 * 60 * 60
      ),
      kind: CodeKind.FORGOT,
      status: true,
    };

    user.forgotCode = forgotCodeObj;
    await user.save();
    const emailRes = await emailService.sendForgotEmail(email, user._id, code);
    const response: UserResetPasswordResponse = {
      message: "Please check your email for password reset",
      user: {
        id: user._id,
        email: user.email,
      },
    };
    return response;
  }

  // public async resetPassword_old(
  //   email: string,
  //   resetCode: string,
  //   password: string
  // ) {
  //   const user = await this.findUserByEmail(email);

  //   if (!user) {
  //     throw new Error(`user with email ${email} is not found`);
  //   }
  //   const userCodes = user.codes || [];
  //   const idx = userCodes.findIndex((item) => item.kind === CodeKind.FORGOT);

  //   if (idx === -1) {
  //     throw new Error("Generate foget code first to reset password");
  //   }

  //   const codeData = userCodes[idx];
  //   if (codeData.code !== resetCode) {
  //     throw new Error("Reset code is invalid");
  //   }

  //   const now = new Date();
  //   const expiryDate = new Date(codeData.codeExpiryDate);
  //   if (now > expiryDate) {
  //     throw new Error(`Code expired on ${expiryDate.toISOString()}`);
  //   }

  //   if (codeData.status === false) {
  //     throw new Error("code has already been used");
  //   }

  //   codeData.status = false;
  //   codeData.useDate = now;
  //   userCodes[idx] = codeData;

  //   const updates: Partial<IUser> = {
  //     password: password,
  //     codes: userCodes,
  //   };

  //   const result = await this.update(user._id, updates);

  //   const response: UserResetPasswordResponse = {
  //     message: "Password successfully reset",
  //     user: {
  //       id: user._id,
  //       email: user.email,
  //     },
  //   };
  //   return response;
  // }
  public async resetPassword(
    userId: string,
    password: string,
    resetCode: number
  ) {
    const user = await this.findById(userId);
    const codeData = user.forgotCode;
    console.log(codeData.code);
    console.log(resetCode);
    if (codeData.code !== resetCode) {
      throw new Error("Reset code is invalid");
    }

    const now = new Date();
    const expiryDate = new Date(codeData.codeExpiryDate);
    if (now > expiryDate) {
      throw new Error(`Code expired on ${expiryDate.toISOString()}`);
    }

    if (codeData.status === false) {
      throw new Error("code has already been used");
    }

    codeData.status = false;
    codeData.useDate = now;

    const updates: Partial<IUser> = {
      password: password,
      forgotCode: codeData,
    };
    const result = await this.update(user._id, updates);

    const response: UserResetPasswordResponse = {
      message: "Password successfully reset",
      user: {
        id: user._id,
        email: user.email,
      },
    };
    return response;
  }
}

export const userService = new UserService(User);
