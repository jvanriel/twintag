import { VERSION } from "../version.ts";
import {TwintagErrorValue, TwintagError} from "./error.model.ts"
/**
 * @internal
 */
export class Client {
    public token?: string

    constructor(token?: string) {
        this.token = token
    }

    public async do<T>(
        path: string,
        args: RequestInit,
        skipParse?: boolean,
        skipAuth?: boolean // TODO: Deprecate in virtual web endpoint.
    ): Promise<[T, TwintagError | undefined]> {

        //Inject authorization for our host
        if (this.token && !skipAuth) {
            const headers = new Headers(args.headers)
            headers.append("Authorization", "Bearer " + this.token);
            args.headers = headers
        }
  
        //Add client analytics
        const headers = new Headers(args.headers)
        headers.append("X-Client-Name", "twintag.js");
        headers.append("X-Client-Version", VERSION);
        args.headers = headers

        const resp = await fetch(new Request(path, args));

        if (!resp.ok) {
            // custom API error
            const err = <[TwintagErrorValue]>await resp.json();
            return [<T>{}, this.CreateTwintagError(err)];
        }

        if (skipParse) {
            if (!resp.body) {
                return [<T>{}, undefined];
            }
            return [<T><unknown>resp.body, undefined]
        }

        try {
            const res = <T>await resp.json();
            return [res, undefined]
        } catch (error) {
            let err = new TwintagErrorValue()
            err.title = 'failed to parse response'
            err.detail = 'something went wrong when parsing response'
            return [<T>{}, this.CreateTwintagError([err])];
        }
    }

    public async get<T>(
        path: string,
        args?: RequestInit,
        skipAuth?: boolean // TODO: Deprecate
    ): Promise<[T, TwintagError | undefined]> {
        if (!args) {
            args = {}
        }
        args.method = "GET"
        return await this.do<T>(path, args, false, skipAuth);
    }

    public async put<T>(
        path: string,
        body: any,
        args?: RequestInit,
        skipAuth?: boolean // TODO: Deprecate
    ): Promise<[T, TwintagError | undefined]> {
        if (!args) {
            args = {}
        }
        args.method = "PUT"
        if (!args.body && body) {
            args.body = JSON.stringify(body)
        }
        return await this.do<T>(path, args, false, skipAuth);
    }

    public async post<T>(
        path: string,
        body: any,
        args?: RequestInit,
        skipAuth?: boolean
    ): Promise<[T, TwintagError | undefined]> {
        if (!args) {
            args = {}
        }
        args.method = "POST"
        if (!args.body && body) {
            args.body = JSON.stringify(body)
        }
        return await this.do<T>(path, args, false, skipAuth);
    }

    public async delete<T>(
        path: string,
        body?: any,
        args?: RequestInit
    ): Promise<[T, TwintagError | undefined]> {
        if (!args) {
            args = {}
        }
        args.method = 'delete'
        if (!args.body && body) {
            args.body = JSON.stringify(body)
        }
        return await this.do<T>(path, args, true);
    }

    private CreateTwintagError(err:any) {
        if(err && err.errors && err.errors.length > 0 ){
            return new TwintagError(err.errors[0].detail, err.errors[0],err.errors[0].title )
        }
        return new TwintagError("Failed to perform the request", err, "Twintag Error")
    }
}