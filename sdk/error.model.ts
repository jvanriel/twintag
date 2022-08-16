export class TwintagErrorValue {
	status :number   
	title  :string 
	detail :string 
}
export class TwintagError extends Error {
    constructor(message:string, errors?: TwintagErrorValue[], name?: string, stack?: string) {
        super(message)
        this.name = name || ''
        this.stack = stack
        this.errors = errors || []
    }
    setMessage(message:string) {
        this.message = message
    }
	errors : TwintagErrorValue[]
}