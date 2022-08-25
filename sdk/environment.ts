class Environment {

    private _host = 'https://twintag.io';
    private _adminHost = '';
    private _cachingHost = '';
    public useCaching = false;
    public _logLevel: 'none'|'single'|'headers'|'body' = 'none'

    private autoDetect = true;

    public get host(): string {
        this.autoDetectOrigin();
        return this._host
    }
    public set host(host: string) {
        this.autoDetect = false;
        this._host = host;
    }

    public get adminHost(): string {
        this.autoDetectOrigin();
        return this._adminHost
    }
    public set adminHost(adminHost: string) {
        this.autoDetect = false;
        this._adminHost = adminHost;
    }

    public get cachingHost(): string {
        this.autoDetectOrigin();
        return this._cachingHost
    }
    public set cachingHost(cachingHost: string) {
        this.autoDetect = false;
        this._cachingHost = cachingHost;
    }

    private autoDetectOrigin() {
        if (!this.autoDetect)
            return

        if (typeof window !== 'undefined'
            && window.location?.hostname !== "localhost"
            && window.location?.hostname !== "127.0.0.1") {
            this._host = window.location.origin;
        }

        const base = new URL(this._host);

        const adminSub = 'admin.'
        const cachingSub = 'cache.'
        this._adminHost = `${base.protocol}//${adminSub}${base.host}`
        this._cachingHost = `${base.protocol}//${cachingSub}${base.host}`

        this.autoDetect = false;
    }

    public set logLevel(logLevel:'none'|'single'|'headers'|'body') {
        this._logLevel = logLevel
    }
}
/**
 * Default environment config.
 * 
 * @Internal
 */
export const environment = new Environment();
