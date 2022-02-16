import _ from "lodash";

export class ApiError extends Error{

    errors: string[] = []
    status: number
    constructor(messages: string[] | string, status?: number){
        super((messages instanceof Array)? _.join(messages,", "): messages);
        this.errors = messages as string[];
        if(! (messages instanceof Array)){
            this.errors = [messages];
        }

        this.name = this.constructor.name;
        this.status = status ? status : 400;

        Error.captureStackTrace(this, this.constructor);

    }

}