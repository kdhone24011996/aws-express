import crypto from "crypto";
import  {Buffer} from  "buffer";
import {SESSION_SECRET} from "./secrets";

export const encrypText = (text: string): string => {
    const algorithm = "aes-192-cbc";
    // const key = crypto.scryptSync(SESSION_SECRET, 'salt', 24);
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(SESSION_SECRET, salt, 24);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encryptedMessage = cipher.update(text, "utf8", "hex");
    encryptedMessage = encryptedMessage + cipher.final("hex");

    const ivS = iv.toString("hex");
    const saltS = salt.toString("hex");
    const final = ivS + saltS + encryptedMessage;
    return final;
};


export const decrptText = (encrypted: string): string => {
    const algorithm = "aes-192-cbc";
    const UTFBYTES = 2;
    const iv = encrypted.slice(0, 16 * UTFBYTES);
    const salt = encrypted.slice(16 * UTFBYTES, (16 + 16) * UTFBYTES);
    const encrypt = encrypted.slice((16 + 16) * UTFBYTES);

    const ivB = Buffer.from(iv, "hex");
    const saltB = Buffer.from(salt, "hex");

    const key = crypto.scryptSync(SESSION_SECRET, saltB, 24);

    const decipher = crypto.createDecipheriv(algorithm, key, ivB);
    const decrypted = decipher.update(encrypt, "hex", "utf8") + decipher.final("utf8");
    return decrypted;
};
