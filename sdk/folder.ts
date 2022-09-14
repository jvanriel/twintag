import { Twintag } from "./twintag.ts";
import { View } from "./view.ts";
import { FileInfo as TwintagFileInfo } from "./files.ts";
import { readerFromStreamReader, Buffer } from "./deps.ts";
import { iterateReader } from "https://deno.land/std@0.153.0/streams/conversion.ts";

type TwintagFolderInfo = {
  fileQid: string;
  fileMode: number;
  fileName: string;
  modTime: Date;
}

class FileInfo {
  #FileQid: string
  #Parent: string|undefined
  #FileMode: string
  #TemplateBagId: string
  type:'file'|'folder'|'unknown'
  name: string
  size: number
  time: Date

  constructor(fi:TwintagFileInfo) {
    this.#TemplateBagId = fi.TemplateBagId ?? ''
    this.#FileQid = fi.FileQid
    this.#Parent = fi.Parent
    this.#FileMode = fi.FileMode
    this.name = fi.Name
    this.size = fi.Size
    this.time = fi.MTime
    switch (fi.FileMode) {
      case '420':
        this.type = 'file'
        break
      case '493':
        this.type = 'folder'
        break
      default:
        this.type = 'unknown'
        break
    }
  }

  toTwintagFileInfo() {
    return {
      FileQid: this.#FileQid,
      Parent: this.#Parent,
      FileMode: this.#FileMode,
      Name: this.name,
      Size: this.size,
      MTime: this.time,
      TemplateBagId: this.#TemplateBagId,
    } as TwintagFileInfo
  }
}

const convert_fileinfo = (fi:TwintagFileInfo) => {
  return new FileInfo(fi)
}

const convert_fileinfo_array = (fis:TwintagFileInfo[]) => {
  return fis.map(fi => {return convert_fileinfo(fi)}) 
}

export class Folder {
  twt:Twintag
  bag:View
  #folderQid: string
  name:string

  constructor(twt:Twintag, bag:View, name:string, folderQid: string) {
    //console.log('NAME', name, 'FOLDERQID', folderQid)
    this.twt = twt
    this.bag = bag
    this.#folderQid = folderQid
    this.name = name
  }

  async listItems():Promise<FileInfo[]>{
    if (this.bag === null) {
      throw Error('bag list; bag not created')
    }
    //console.log('FOLDER', this.name, 'FOLDERQID', this.#folderQid)
    const list = await this.bag.list(this.#folderQid)
    if (Array.isArray(list)) {// TWINTAG: may return { is:..., state: 'deleted'} 
      // TWINTAG: this.bag.list('') also gives files in subfolders!
      const filtered = list.filter(f => f.Parent == this.#folderQid)
      //console.log('FILTERED', filtered)
      return convert_fileinfo_array(filtered)
    }
    return []
  }

  async listFiles():Promise<FileInfo[]>{
    const items = await this.listItems()
    return items.filter(f => f.type === 'file')
  }

  async listFolders():Promise<FileInfo[]>{
    const items = await this.listItems()
    return items.filter(f => f.type === 'folder')
  }

  async findFile(name:string):Promise<FileInfo|null>{
    const list = await this.listFiles()
    const found = list.find(f => f.name === name)
    return found === undefined ? null : found
  }

  async findFolderInfo(name:string):Promise<FileInfo|null>{
    const list = await this.listFolders()
    const found = list.find(f => f.name === name)
    return found === undefined ? null : found
  }

  async findFolder(name:string):Promise<Folder|null>{
    const list = await this.bag.list(this.#folderQid)
    if (Array.isArray(list)) { // TWINTAG: may return { is:..., state: 'deleted'} 
      const found = list.find(f => f.Name === name)
      if (!found) {
        return null
      } else {
        return new Folder(this.twt, this.bag, name, found.FileQid)
      }
    } else {
      return null
    }
  }

  async removeFile(name:string):Promise<void>{
    if (this.bag === null) {
      throw Error('bag remove; bag not created')
    }
    const list = await this.listFiles()
    const fileInfo = list.find(f => f.name === name)
    if (fileInfo) {
      await this.bag.delete(fileInfo.toTwintagFileInfo())
    }
  }

  /*
    File readers
  */

  async readAsReadableStream(name:string):Promise<ReadableStream>{
    if (this.bag === null) {
      throw Error('bag read; bag not created')
    }
    if (this.#folderQid === '') {
      return await this.bag.download(name)
    } else {
      const url = await this.downloadUrl(name)
      const rsp = await fetch(url)

      if (rsp.status === 200) {
        if (rsp.body) {
          return rsp.body
        } else {
          throw Error('missing body')
         }
      } else {
        if (rsp.body) {
          rsp.body.cancel()
        }
        throw Error(`name '${name}' status ${rsp.status}`)
      }
    }
  }

  async readAsBuffer(name:string):Promise<Buffer>{
    const stream = await this.readAsReadableStream(name)
    const reader = readerFromStreamReader(stream.getReader())
    const buffer = new Buffer()
    await buffer.readFrom(reader)
    return buffer
  }

  async readAsString(name:string):Promise<string>{
    const buffer = await this.readAsBuffer(name)
    return new TextDecoder().decode(buffer.bytes())
  }

  // deno-lint-ignore no-explicit-any
  async readAsJson(name:string):Promise<any>{
    const text = await this.readAsString(name)
    return JSON.parse(text)
  }

  async readAsBlob(name:string):Promise<Blob>{
    const buffer = await this.readAsBuffer(name)
    return new Blob([buffer.bytes()])
  }

  async readAsFile(name:string):Promise<File>{
    const blob = await this.readAsBlob(name)
    return new File([blob], name)
  }

  async downloadUrl(fileName:string):Promise<string>{
    const folderList = await this.bag.list(this.#folderQid)
    const fileInfo = folderList.find(fi => fi.Name === fileName)
    if (!fileInfo) {
      throw Error(`Not Found; file '${fileName}'`)
    }
    return this.twt.Url(`/api/v1/views/${this.bag.qid}/files/${fileInfo.FileQid}`)
  }

  async downloadUrlFromTemplateBag(fileName:string):Promise<string>{
    const folderList = await this.bag.list(this.#folderQid)
    const fileInfo = folderList.find(fi => fi.Name === fileName)
    if (!fileInfo) {
      throw Error(`Not Found; file '${fileName}'`)
    }
    return this.twt.Url(`/api/v1/views/${fileInfo.TemplateBagId}/files/${fileInfo.FileQid}`)
  }

  /*
    File writers
  */

  async writeFromFile(file:File){
    if (this.bag === null) {
      throw Error('bag write; bag not created')
    }
    const fi = await this.bag.upload(file, file.name, this.#folderQid === '' ? undefined : this.#folderQid)
    return convert_fileinfo(fi)
  }

  async writeFromBlob(name: string, blob:Blob){
    const file = new File([blob], name)
    return await this.writeFromFile(file)
  }

  async writeFromBuffer(name: string, buffer:Buffer){
    const blob = new Blob([buffer.bytes()])
    return await this.writeFromBlob(name, blob)
  }

  async writeFromString(name: string, text:string){
    const buffer = new Buffer(new TextEncoder().encode(text))
    const blob = new Blob([buffer.bytes()])
    return await this.writeFromBlob(name, blob)
  }

  // deno-lint-ignore no-explicit-any
  async writeFromJson(name: string, json:any){
    return await this.writeFromString(name, JSON.stringify(json))
  }

  /* 
    Folder Ops
  */


  async #findFolderQidInParent(parentQid: string, name:string) {
    const list = await this.bag?.list(parentQid)
    if (list === undefined) {
      return null
    }
    const found = list.filter(f => f.FileMode === '493').find(f => f.Name === name)
    return found ? found.FileQid : null
  }


  async resolve(path:string) {
    if (path === '') {
      throw Error('empty path')
    }
    if (this.bag === null) {
      throw Error('bag not created')
    }
    if (path === '/') {
      return new Folder(this.twt, this.bag, '/', '')
    }

    let folderQid = ''
    let folderName = ''

    const parts = path.split("/").slice(1)
    //console.log('PARTS', parts)
 
    for (const name of parts) {
      //console.log('NAME', name)
      const found = await this.#findFolderQidInParent(folderQid, name)
      if (found === null) {
        return null
      }
      folderQid = found
      folderName = name
    }

    return new Folder(this.twt, this.bag, folderName, folderQid)
  }

  async createFolder(name:string) {
    const folderInfo = await this.bag.addFolder<TwintagFolderInfo>(name, this.#folderQid)
    return new FileInfo({
      FileQid: folderInfo.fileQid,
      Parent: this.#folderQid,
      Name: folderInfo.fileName,
      Size: 0,
      MTime: folderInfo.modTime,
      FileMode: folderInfo.fileMode.toString(),
    } as TwintagFileInfo)
  }

  async removeFolder(name:string) {
    const found = await this.findFolderInfo(name)
    if (found) {
      const fileInfo = found.toTwintagFileInfo()
      await this.bag.delete(fileInfo)
    }
  }

}