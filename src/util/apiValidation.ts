import { Types } from "mongoose";

export const ID = Types.ObjectId;

type fun = {
  path: any;
  req: any;
  location: any;
};
export const mongoID = (value: any, { path }: fun) => {
  try {
    const id = new ID(value);
    return id;
  } catch (err) {
    let msg = err.message || "";
    msg = `Argument: '${path}' error: ${msg}`;
    throw new Error(msg);
  }
};

export const JsonString = (value: any, { path }: fun) => {
  try {
    const str = JSON.stringify(value);
    return str;
  } catch (err) {
    let msg = err.message || "";
    msg = `Argument: '${path}' error: ${msg}`;
    throw new Error(msg);
  }
};
