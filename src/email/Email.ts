

export interface EmailI {
    send(from: string,  to: string, subject: string,  message: string): Promise<any>;   

}