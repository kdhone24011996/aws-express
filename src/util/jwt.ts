import jwt from "jsonwebtoken";
import { Algorithm, SignOptions } from "jsonwebtoken";
import { SESSION_SECRET, TOKEN_EXPIRY, TOKEN_REFRESH_EXPIRY, TOKEN_AUDIENCE, TOKEN_ISSUER } from "./secrets";
import { epochToDate } from "./common";


const algorithm: Algorithm = "HS256";
const refreshExpiry = TOKEN_REFRESH_EXPIRY;
const tokenExpiry = TOKEN_EXPIRY;

export const options = {
    algorithm,
    noTimestamp: false,
    expiresIn: tokenExpiry,
    audience: TOKEN_AUDIENCE,
    issuer: TOKEN_ISSUER,
};

export const signToken = (payload: any, expiry?: string) => {
    // const jwtSignOptions = Object.assign({}, signOptions, options)
    const signOptions = Object.assign({}, options);
    if (expiry) {
        signOptions.expiresIn = expiry;
    }

    const jwtSignOptions: SignOptions = signOptions;
    return jwt.sign(payload, SESSION_SECRET, jwtSignOptions);
};



// refreshOptions.verify = options you would use with verify function
// refreshOptions.jwtid = contains the id for the new token
export const refreshToken = (token: string) => {
    const refreshOptions = { ...options, ignoreExpiration: true };
    const payload = jwt.verify(token, SESSION_SECRET, refreshOptions);
    const pay: any = payload;
    delete pay.iat;
    delete pay.exp;
    delete pay.nbf;
    delete pay.aud;
    delete pay.iss;
    delete pay.jti; // We are generating a new token, if you are using jwtid during signing, pass it in refreshOptions
    // The first signing converted all needed options into claims, they are already in the payload
    return jwt.sign(pay, SESSION_SECRET, options);
};


export const verifyToken = (token: string, ignoreExpiration?: boolean) => {
    const verifyOptions: any = Object.assign({}, options);
    if (ignoreExpiration===true){
        verifyOptions.ignoreExpiration = true;
    }

    const payload = jwt.verify(token, SESSION_SECRET, verifyOptions);
    return payload;
};

export interface TokenResponse {
    token: string;
    refreshToken: string;
    tokenExpiry: string;
    refreshExpiry: string;
    tokenIssueDate: string;
    refreshIssueDate: string;
}

export const generateToken = (payload: any) => {
    payload = { ...payload, refresh: false };

    const refreshPayload = {
        refresh: true
    };

    const token = signToken(payload, tokenExpiry);
    const refreshToken = signToken(refreshPayload, refreshExpiry);

    const tokenPayload: any = verifyToken(token);
    const exp = epochToDate(tokenPayload.exp);
    const iat = epochToDate(tokenPayload.iat);

    const rPayload: any = verifyToken(refreshToken);
    const rExp = epochToDate(rPayload.exp);
    const rIat = epochToDate(rPayload.iat);


    const response: TokenResponse = {
        token,
        refreshToken,
        tokenExpiry: exp.toISOString(),
        refreshExpiry: rExp.toISOString(),
        tokenIssueDate: iat.toISOString(),
        refreshIssueDate: rIat.toISOString()
    };

    return response;
};