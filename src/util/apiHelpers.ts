import { NextFunction, Response, Request, response } from "express";
import { ENVIRONMENT } from "./secrets";
import logger from "./logger";
import _ from "lodash";
import { validationResult } from "express-validator";
import {ApiError} from "../errors/apierror";

export type IQuery<T> = Partial<Record<keyof T, any>>


export interface ApiResponse {
    stack: string;
    errors: string[];
    result: any;

}
const injectPagination = (res: Response, result: any) => {
    if (result && result.pagination && (result.pagination.next ==="" || result.pagination.next)){

        const fullUrl = res.req?.protocol + "://" + res.req?.get("host") + res.req?.originalUrl;
        const nextpage = fullUrl +  `?page=${result.pagination.page+1}&perPage=${result.pagination.perPage}`;
        const prevpage = fullUrl +  `?page=${result.pagination.page-1}&perPage=${result.pagination.perPage}`;
        result.pagination.next = null;
        result.pagination.previous = null;
        if (result.pagination.hasNext){
            result.pagination.next = nextpage;
        }
        if (result.pagination.hasPrevious){
            result.pagination.previous = prevpage;
        }
    }
    return result;
};
export const apiOk = async (res: Response, result: any) => {

    result = injectPagination(res, result);
    const response: ApiResponse = {
        result,
        errors: [],
        stack: ""
    };
    res.status(200).json(response);
};

export const apiError = async (res: Response, err: string | string[] | ApiError | Error, statusCode: number = 400) => {
    let myerr: Error = new Error("Something went wrong");
    let errMessages: string[] = [];
    if (err instanceof Array) {
        errMessages = err;

    } else if (typeof err === "string") {
        errMessages.push(err);
    }
    else if(err instanceof ApiError) {
        myerr = err;
        errMessages = err.errors;
    }
    else if (err instanceof Error){
        const msg: string = err.message;
        errMessages.push(msg);
        myerr = err;
    }
    else {
        errMessages.push("Fail to transform thrown error. use string, string[] or Error for throwing errors");
    }

    let stack: string = myerr?.stack;

    if (ENVIRONMENT === "production") {
        stack = "No stack in production";
    }

    const response: ApiResponse = {
        result: null,
        errors: errMessages,
        stack
    };

    res.status(statusCode).json(response);
};


export const errorHandler404 = (req: Request, res: Response, next: NextFunction) => {

    const errMsg: string = `Can't find ${req.url} on this server!`;
    res.status(404);
    next(new Error(errMsg));

};

export const errorUnhandledRejection = (err: any) => {
    logger.error(err);
    // process.exit(1);
};


export const errorUncughtException = (err: any) => {
    logger.error("UNCAUGHT EXCEPTION! Shutting down...");
    logger.error(err);
    process.exit(1);

};

export const errorHandlerAll = (err: Error, req: Request, res: Response, next: NextFunction) => {


    let statusCode = res.statusCode;
    if (statusCode === 200) {
        statusCode = 500;
    }

    logger.error(err);
    apiError(res, err, statusCode);
};

export const catchAsync = (fn: any) => (...args: any[]) => fn(...args).catch(args[2]);

export const apiValidation = (req: Request, res: Response)=>{

    const errors =  validationResult(req);
    if (!errors.isEmpty())
    {
            const errs = errors.array().map(x=>x.msg.toString());
            const err  = new ApiError(errs);
            res.status(400);
            throw err;
    }
};