import { config }  from "./deps.ts"
import * as t from "https://deno.land/std@0.153.0/testing/asserts.ts";
import { beforeAll, afterAll, describe, it } from "https://deno.land/std@0.152.0/testing/bdd.ts";
import { Twintag } from "./twintag.ts"
import { StorageBag } from "./storage_bag.ts";
import { Folder } from "./folder.ts"

describe("Folders", ()=>{
  let twt:Twintag
  let bag:StorageBag|null = null
  let rootFolder:Folder| null = null
  let subFolder:Folder| null = null
  const filename = 'foobar'
  const fldrname = 'somefolder'

  beforeAll(async ()=> {
    const cfg  = await config()
    
    twt = new Twintag(cfg["PROJECT_APIKEY"], cfg["TEMPLATE_VIEWER_QID"], cfg["SUBDOMAIN"])
    twt.setHost('https://twintag.io')
    twt.setAdminHost('https://admin.twintag.io')
    twt.setLogLevel('none')

    bag = new StorageBag(twt)
    await bag.create()

    rootFolder = bag.rootFolder
  })

  afterAll(async ()=> {
    await bag?.delete()
  })

  it("lists empty root folder" ,async () => {
    const list = await rootFolder?.listFiles()
    t.assert(list)
    t.assertEquals(list.length, 0)
  })

  it("writes object to root folder" ,async () => {
    const fileInfo = await rootFolder?.writeFromJson(filename, {foo:'bar'})
    t.assert(fileInfo)
    t.assertEquals(fileInfo.name, filename)
    t.assert(fileInfo.time)
    t.assert(fileInfo.size > 0)
  })

  it("lists non-empty root folder" ,async () => {
    const list = await rootFolder?.listFiles()
    t.assert(list)
    t.assertEquals(list.length, 1)
  })

  it("reads object from root folders" ,async () => {
    const json = await rootFolder?.readAsJson(filename)
    t.assert(json)
    t.assertEquals(json["foo"], "bar")
  })

  it("fetches object downloadUrl from root" ,async () => {
    const url = await rootFolder?.downloadUrl(filename)
    t.assert(url)
    t.assert(url.length > 0)
  })

  it("removes object from root folder" ,async () => {
    await rootFolder?.removeFile(filename)
  })

  it("lists empty root folder" ,async () => {
    const list = await rootFolder?.listFiles()
    t.assert(list)
    t.assertEquals(list.length, 0)
  })

  it("creates folder in root folder" ,async () => {
    const folder = await rootFolder?.createFolder(fldrname)
    t.assert(folder)
    t.assertEquals(folder.name, fldrname)
  })

  it("lists folders in root folder" ,async () => {
    const list = await rootFolder?.listFolders()
    t.assert(list)
    t.assertEquals(list.length, 1)
  })

  it("resolves folder in root folder" ,async () => {
    const folder = await rootFolder?.resolve(`/${fldrname}`)
    t.assert(folder)
    t.assertEquals(folder.name, fldrname)
    subFolder = folder
  })

  it("writes object in subfolder" ,async () => {
    const fileInfo = await subFolder?.writeFromJson(filename, {hello:'world'})
    t.assert(fileInfo)
    t.assertEquals(fileInfo.name, filename)
    t.assert(fileInfo.time)
    t.assert(fileInfo.size > 0)
  })

  it("lists files in subfolder" ,async () => {
    const list = await subFolder?.listFiles()
    t.assert(list)
    t.assertEquals(list.length, 1)
  })

  it("reads object from subfolder" ,async () => {
    const json = await subFolder?.readAsJson(filename)
    t.assert(json)
    t.assertEquals(json["hello"], "world")
  })

  it("fetches object downloadUrl from subfolder" ,async () => {
    const url = await subFolder?.downloadUrl(filename)
    t.assert(url)
    t.assert(url.length > 0)
  })

  it("removes object from subfolder" ,async () => {
    await subFolder?.removeFile(filename)
  })

  it("lists files in subfolder" ,async () => {
    const list = await subFolder?.listFiles()
    t.assert(list)
    t.assertEquals(list.length, 0)
  })

  it("removes folder from root folder" ,async () => {
    await rootFolder?.removeFolder(fldrname)
  })

  it("lists folders in root folder" ,async () => {
    const list = await rootFolder?.listFolders()
    t.assert(list)
    t.assertEquals(list.length, 0)
  })

})
