import { Twintag } from "./twintag.ts";
import { View } from "./view.ts";
import { FileInfo as TwintagFileInfo } from "./files.ts";
import { readerFromStreamReader, Buffer } from "./deps.ts";

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
  name: string
  size: number
  time: Date

  constructor(fi:TwintagFileInfo) {
    this.#FileQid = fi.FileQid
    this.#Parent = fi.Parent
    this.#FileMode = fi.FileMode
    this.name = fi.Name
    this.size = fi.Size
    this.time = fi.MTime
  }

  toTwintagFileInfo() {
    return {
      FileQid: this.#FileQid,
      Parent: this.#Parent,
      FileMode: this.#FileMode,
      Name: this.name,
      Size: this.size,
      MTime: this.time
    } as TwintagFileInfo
  }
}

class FolderInfo {
  #fileQid: string
  #parent: string
  #fileMode: number
  name: string
  time: Date

  constructor(fi:TwintagFolderInfo, parentQid:string) {
    this.#fileQid = fi.fileQid
    this.#fileMode = fi.fileMode
    this.#parent = parentQid
    this.name = fi.fileName
    this.time = fi.modTime
  }

  toTwintagFileInfo() {
    return {
      FileQid: this.#fileQid,
      Parent: this.#parent,
      FileMode: this.#fileMode.toString(),
      Name: this.name,
      Size: 0,
      MTime: this.time
    } as TwintagFileInfo
  }
}

const convert_fileinfo = (fi:TwintagFileInfo) => {
  return new FileInfo(fi)
}

const convert_fileinfo_array = (fis:TwintagFileInfo[]) => {
  return fis.filter(fi => fi.FileMode === '420').map(fi => {return convert_fileinfo(fi)}) 
}

const convert_twintagfolderinfo_folderinfo = (fi:TwintagFolderInfo, parentQid:string) => {
  return new FolderInfo(fi, parentQid)
}

const convert_twintagfileinfo_to_folderinfo = (fi:TwintagFileInfo, parentQid:string) => {
  return new FolderInfo({
    fileQid: fi.FileQid,
    fileMode: parseInt(fi.FileMode),
    fileName: fi.Name,
    modTime: fi.MTime
  } as TwintagFolderInfo, parentQid)
}

const convert_twintagfileinfo_to_folderinfo_array = (fis:TwintagFileInfo[], parentQid:string) => {
  return fis.filter(fi => fi.FileMode === '493').map(fi => {return convert_twintagfileinfo_to_folderinfo(fi, parentQid)}) 
}

export class Folder {
  twt:Twintag
  bag:View
  #parentQid: string
  name:string

  constructor(twt:Twintag, bag:View, name:string, parentQid: string) {
    this.twt = twt
    this.bag = bag
    this.#parentQid = parentQid
    this.name = name
  }

  async listFiles():Promise<FileInfo[]>{
    if (this.bag === null) {
      throw Error('bag list; bag not created')
    }
    const list = await this.bag.list('')
    return convert_fileinfo_array(list)
  }

  async listFolders():Promise<FolderInfo[]>{
    if (this.bag === null) {
      throw Error('bag list; bag not created')
    }
    const list = await this.bag.list('')
    return convert_twintagfileinfo_to_folderinfo_array(list, this.#parentQid)
  }

  async findFile(name:string):Promise<FileInfo|null>{
    const list = await this.listFiles()
    const found = list.find(f => f.name === name)
    return found === undefined ? null : found
  }

  async findFolder(name:string):Promise<FolderInfo|null>{
    const list = await this.listFolders()
    const found = list.find(f => f.name === name)
    return found === undefined ? null : found
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
    return await this.bag.download(name)
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

  /*
    File writers
  */

  async writeFromFile(file:File){
    if (this.bag === null) {
      throw Error('bag write; bag not created')
    }
    const fi = await this.bag.upload(file, file.name)
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

    let parentQid = ''
    let folderName = ''

    const parts = path.split("/").slice(1)
    //console.log('PARTS', parts)
 
    for (const name of parts) {
      //console.log('NAME', name)
      const found = await this.#findFolderQidInParent(parentQid, name)
      if (found === null) {
        return null
      }
      parentQid = found
      folderName = name
      //console.log('PARENTQID', parts, 'folderName', folderName)
    }

    return new Folder(this.twt, this.bag,  folderName, parentQid)

  }

  async createFolder(name:string) {
    const folderInfo = await this.bag.addFolder<TwintagFolderInfo>(name, this.#parentQid)
    return convert_twintagfolderinfo_folderinfo(folderInfo, this.#parentQid)
  }

  async removeFolder(name:string) {
    const found = await this.findFolder(name)
    if (found) {
      const fileInfo = found.toTwintagFileInfo()
      await this.bag.delete(fileInfo)
    }
  }

}