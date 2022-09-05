import { Twintag } from "./twintag.ts";
import { View } from "./view.ts";
import { Folder } from "./folder.ts";

export class StorageBag {
  twt:Twintag
  bag:View|null = null
  rootFolder:Folder|null = null

  constructor(twt:Twintag, bag?:View) {
    this.twt = twt
    this.bag = bag ? bag : null
  }

  async create() {
    this.bag = await this.twt.project.createBag()
    this.rootFolder = new Folder(this.twt, this.bag, '/', '')
  }

  async delete() {
    if (this.bag === null) {
      throw Error('bag delete; bag not created')
    }
    await this.bag.deleteProjectTwintag()
  }

 
  

}