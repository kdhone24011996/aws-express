import { Document, model, Mongoose, Schema } from "mongoose";
import { Roles } from "./Roles";
import bcrypt from "bcryptjs";

type ComparePasswordFunction = (candidatePassword: string) => Promise<boolean>;

export enum TokenKind {
  REFRESH = "Refresh",
}
export enum CodeKind {
  FORGOT = "Forgot",
}
export enum Gender {
  MALE = "Male",
  FEMALE = "Female",
  OTHER = "Other",
  NULL = "",
}

export interface IVerification {
  code?: string;
  codeExpiryDate?: Date;
  lastCodeSend?: Date;
  codeSendCount?: number;

  verified?: boolean;
  verificationDate?: Date;
}

export interface ITokens {
  token: string;
  status: boolean;
  kind: TokenKind;
  issued: Date;
}

export interface ICodes {
  code: string | number;
  codeExpiryDate: Date;
  lastCodeSend?: Date;
  codeSendCount?: number;
  status?: boolean;
  useDate?: Date;
  kind: CodeKind;
}

export interface IAddress {
  name: string;
  phoneNumber: string;
  line1: string;
  line2: string;
  zipCode: number;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
}

export interface Profile {
  firstName: string;
  lastName: string;
  gender: Gender;
  shippingAddresses: IAddress[];
  phoneNumber: string;
  role: Roles;
}

export interface IUser {
  email: string;
  password?: string;
  profile?: Profile;
  tokens?: ITokens[];
  verfication?: IVerification;
  forgotCode?: ICodes;
  agreeToTerms?: boolean;
  googleUserId?: string;
  facebookUserId?: string;
}

const schemaFields: Record<keyof IUser, any> = {
  email: { type: String, required: true, unique: true },
  password: { type: String },
  profile: {
    firstName: { type: String, default: null, required: false },
    lastName: { type: String, default: null, required: false },
    gender: { type: String, enum: Object.values(Gender), default: "" },
    phoneNumber: { type: String, default: null },
    role: { type: String, enum: Object.values(Roles), default: Roles.USER },

    shippingAddresses: {
      type: [
        {
          name: String,
          phoneNumber: String,
          line1: String,
          line2: String,
          zipCode: Number,
          city: String,
          state: String,
          country: String,
          isDefault: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
  },
  tokens: [
    {
      token: { type: String, required: true },
      status: { type: Boolean, required: true },
      kind: { type: String, enum: Object.values(TokenKind), required: true },
      issued: { type: Date, required: true },
    },
  ],
  verfication: {
    code: { type: String, default: null },
    codeExpiryDate: { type: Date, default: null },
    lastCodeSend: { type: Date, default: null },
    codeSendCount: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    verificationDate: { type: Date, default: null },
  },
  forgotCode: {
    type: {
      code: { type: Number, required: true },
      codeExpiryDate: { type: Date, required: true },
      lastCodeSend: { type: Date },
      codeSendCount: Number,
      status: Boolean,
      useDate: Date,
      kind: { type: String, enum: Object.values(CodeKind) },
    },
  },
  agreeToTerms: { type: Boolean, default: false },
  googleUserId: { type: String, default: null },
  facebookUserId: { type: String, default: null },
};

export interface UserDoc extends IUser, Document {
  comparePassword: ComparePasswordFunction;
}
const schema = new Schema(schemaFields, { timestamps: true });

schema.pre("save", function (next) {
  const user = this as UserDoc;
  if (!user.isModified("password")) {
    return next();
  }
  bcrypt.genSalt(10, (err, salt) => {
    if (err) {
      return next(err);
    }
    bcrypt.hash(user.password, salt, (err, hash) => {
      if (err) {
        return next(err);
      }
      user.password = hash;
      next();
    });
  });
});

const comparePassword: ComparePasswordFunction = async function (
  candidatePassword
) {
  const promise = new Promise<boolean>((res, rej) => {
    const myHashedPassword = this.password || "";
    bcrypt.compare(
      candidatePassword,
      myHashedPassword,
      (err, isMatch: boolean) => {
        if (err) {
          rej(err);
          return;
        }
        res(isMatch);
      }
    );
  });

  return promise;
};

schema.methods.comparePassword = comparePassword;

export const User = model<UserDoc>("User", schema);
