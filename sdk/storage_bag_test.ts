import { config }  from "./deps.ts"
import * as t from "https://deno.land/std@0.153.0/testing/asserts.ts";
import { beforeAll, afterAll, describe, it } from "https://deno.land/std@0.152.0/testing/bdd.ts";
import { Twintag } from "./twintag.ts"
import { StorageBag } from "./storage_bag.ts";

describe("StorageBag", ()=>{
  let twt:Twintag
  let bag:StorageBag|null = null

  beforeAll(async ()=> {
    const cfg  = await config()
    
    twt = new Twintag(cfg["PROJECT_APIKEY"], cfg["TEMPLATE_VIEWER_QID"], cfg["SUBDOMAIN"])
    twt.setHost('https://twintag.io')
    twt.setAdminHost('https://admin.twintag.io')
    twt.setLogLevel('none')

    bag = new StorageBag(twt)
    await bag.create()
  })

  afterAll(async ()=> {
    await bag?.delete()
  })

  it("checks root folder" , () => {
    const folder = bag?.rootFolder
    t.assert(folder)
  })


})
