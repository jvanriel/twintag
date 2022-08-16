/**
 * A virtual file is a file that doesn't have static content like a normal file.
 * Instead, the content of the file is materialized upon request.
 * 
 * To create a virtual file you first construct one of the VirtualFile sub-classes.
 * Next, you upload them using {@link View.uploadVirtual}. E.g.:
 * ```js
 * let virtual = new Zaza.Link("https://example.com")
 * await view.uploadVirtual(virtual, "My link")
 * ```
 */
export abstract class VirtualFile {
    /**
     * Get the virtual file mode.
     * 
     * @internal
     */
    readonly mode: number;
    
    /**
     * Construct a virtual file.
     *
     * @internal 
     * */
    constructor(mode: number) {
        this.mode = mode
    }
    
    /**
     * Get the virtual file definition.
     * 
     * @internal
     */
    abstract GetDefinition(): definition 
}

/**
 * A link is a virtual file that represents a web link.
 * 
 * First construct the link, next upload it to a bag using {@link View.uploadVirtual}. E.g.:
 * ```js
 * let virtual = new Zaza.Link("https://example.com")
 * await view.uploadVirtual(virtual, "My link")
 * ```
 */
export class Link extends VirtualFile {
    /**
     * 
     * The link URL.
     */
    readonly url: string;
    /**
     * 
     * The link target.
     */
    readonly target: string;
    /**
     * 
     * Construct a web link by URL.
     *
     * @param target The default target is "_blank ". Other targets may be restricted.
     */
    constructor(url: string, target?: string) {
        super(50)
        
        this.url = url
        this.target = "_blank"
        if (target) {
            this.target = target
        }
    }
    
    /**
     * Get the virtual file definition.
     * 
     * @internal
     */
    public GetDefinition(): definition {
        const def: definition = {
            specversion: "1.0",
            definition:{
                type: "web-link",
                data: {
                    url: this.url,
                    target: this.target
                }
            }
        }
        return def;
    }
}

/**
 * Link virtual file data.
 * 
 * @internal
 */
export interface linkData {
    url: string;
    target: string;
}

/**
 * Virtual file definition data.
 * 
 * @internal
 */
export interface definitionData {
    type: string;
    data: linkData;
}

/**
 * Virtual file definition.
 * 
 * @internal
 */
export interface definition {
    specversion: string;
    definition: any;
}