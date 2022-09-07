import { VERSION } from "../version.ts";
import {TwintagErrorValue, TwintagError} from "./error.model.ts";
import { environment } from "./environment.ts";


/**
 * @internal
 */
export class Client {
    public token?: string
    
    start = 0

    constructor(token?: string) {
        this.token = token
    }

    private hasLoggableRequestBody(req:Request) {
        if (!req.body) {
            return false
        }
        const contentType = req.headers.get('Content-Type')
        if (contentType) {
            const types = ['application/json', 'application/graphql', 'application/graphql+json']
            const found = types.find(t => t === contentType)
            return (found !== null)
        } 
        return false
    }

    private logHeaders(headers:Headers) {
        for (const header of headers) {
            if (header[0] !== 'authorization') {
                console.log(' ', header[0],': ', header[1])
            } else {
                if (header[1].startsWith('Bearer')) {
                    const beg = header[1].slice(20, 40)
                    const end = header[1].slice(header[1].length-20, header[1].length)
                    console.log(' ', header[0],': Bearer', beg, '...' ,end)
                } else {
                    console.log(' ', header[0],': ', header[1])
                }
            }
        }  
    }

    // Optionally tee the body stream for regular fetching and console logging
    private logRequest(req:Request): ReadableStream<Uint8Array> | null {
        switch (environment._logLevel) {
            case 'none':
                return null
            case 'single':
                return null
            case 'headers':
                console.log(req.method, req.url.toString())
                this.logHeaders(req.headers)
                return null
            case 'body': {
                console.log(req.method, req.url.toString())
                this.logHeaders(req.headers)
                if (this.hasLoggableRequestBody(req)) {
                    const tee = req.body!.tee()
                    console.log(tee[0])
                    return tee[1]
                } else {
                    return null
                }
            } 
        }
    }

    private logResponse(req:Request, rsp:Response, text?:string) {
        switch (environment._logLevel) {
            case 'none':
                return
            case 'single':
                console.log(req.method, req.url.toString(), rsp.status, rsp.statusText, `${Date.now()-this.start}ms`)
                return
            case 'headers':
                console.log(rsp.status, rsp.statusText, `${Date.now()-this.start}ms`)
                this.logHeaders(req.headers)
                return
            case 'body': {
                console.log(rsp.status, rsp.statusText, `${Date.now()-this.start}ms`)
                this.logHeaders(req.headers)
                if (text) {
                    console.log(text)
                }
                break
            } 
        }        
    }

    private logError(req:Request|null, rsp:Response|null, text:string) {
        switch (environment._logLevel) {
            case 'none':
                return null
            case 'single':
                console.log(req ? req.method : '', req ? req.url.toString() : '', rsp ? rsp.statusText : 0, `${Date.now()-this.start}ms`)
                return null
            case 'headers':
                console.log(rsp ? rsp.statusText : 0, `${Date.now()-this.start}ms`)
                if (req) {
                    for (const header of req.headers) {
                        console.log(' ',header[0],': ', header[1])
                    }
                }
                return null
            case 'body': {
                console.log(rsp ? rsp.statusText : 0, `${Date.now()-this.start}ms`)
                if (req) {
                    for (const header of req.headers) {
                        console.log(' ', header[0],': ', header[1])
                    }
                }
                console.log(text)
                break
            } 
        }        
    }

    public async do<T>(
        path: string,
        args: RequestInit,
        skipParse?: boolean,
        skipAuth?: boolean // TODO: Deprecate in virtual web endpoint.
    ): Promise<[T, TwintagError | undefined]> {
        this.start = Date.now()

        //console.log('CLIENT','PATH', path, 'SKIPPARSE', skipParse)

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
        let request:Request|null = null
        let response:Response|null = null

        try {
            request = new Request(path, args)

            const stream = this.logRequest(request)
            if (stream) {
                args.body = stream
            }

            response = await fetch(request);
  
            if (!response.ok) {
                // custom API error
                const json = await response.json();
                this.logResponse(request, response, json)
                const err = <[TwintagErrorValue]>json;
                return [<T>{}, this.CreateTwintagError(err)];
            }

            if (skipParse) {
                if (!response.body) {
                    this.logResponse(request, response)
                    return [<T>{}, undefined];
                }
                this.logResponse(request, response)
                return [<T><unknown>response.body, undefined]
            }

            try {
                const json = await response.json()
                this.logResponse(request, response, json)
                
                const res = <T>json;
                // return [res, undefined]
                const result = [res, undefined] as [T, TwintagError | undefined]
                //console.log('CLIENT', 'RESULT', result[1], typeof result[1], result[1] instanceof Object, 'TRUTHY', result[1] ? 'true' : 'false')
                return result
            } catch (error) {
                const err = new TwintagErrorValue()
                err.title = 'failed to parse response'
                err.detail = `something went wrong when parsing response; ${error}`
                this.logError(request, response, `${err}`)
                return [<T>{}, this.CreateTwintagError([err])];
            }
        } catch (err) {
            this.logError(request, response, `${err}`)
            throw err
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
        // deno-lint-ignore no-explicit-any
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
        // deno-lint-ignore no-explicit-any
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
        // deno-lint-ignore no-explicit-any
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

    // deno-lint-ignore no-explicit-any
    private CreateTwintagError(err:any) {
        if(err && err.errors && err.errors.length > 0 ){
            return new TwintagError(err.errors[0].detail, err.errors[0],err.errors[0].title )
        }
        return new TwintagError("Failed to perform the request", err, "Twintag Error")
    }
}