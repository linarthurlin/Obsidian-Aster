import { Plugin, ItemView, type WorkspaceLeaf } from 'obsidian';
const VIEW='knowledge-agent-workbench';
class Workbench extends ItemView {
  constructor(leaf:WorkspaceLeaf){super(leaf)}
  getViewType(){return VIEW}getDisplayText(){return 'Knowledge Agent'}getIcon(){return 'notebook-pen'}
  async onOpen(){const root=this.contentEl;root.empty();root.addClass('pga-workbench');root.createEl('h2',{text:'Knowledge Agent'});root.createEl('p',{text:'Independent local-first knowledge review workbench.'});root.createEl('p',{cls:'pga-status',text:'No model connected · No background scanning · No automatic note edits'});root.createEl('h3',{text:'Offline review workflow'});root.createEl('p',{text:'The standalone CLI supports local search, source-backed proposals, diff review, explicit apply and rollback. It is not invoked automatically by this plugin.'});root.createEl('p',{text:'Next: choose an explicit corpus and model provider, then implement retrieval and a review interface. See docs/HANDOFF.zh-TW.md in the Agent repository.'});}
  async onClose(){this.contentEl.empty();}
}
export default class KnowledgeAgent extends Plugin {
  async onload(){this.registerView(VIEW,leaf=>new Workbench(leaf));this.addCommand({id:'open-workbench',name:'Open knowledge review workbench',callback:()=>this.openWorkbench()});}
  async openWorkbench(){let leaf=this.app.workspace.getLeavesOfType(VIEW)[0];if(!leaf){leaf=this.app.workspace.getLeaf('tab');await leaf.setViewState({type:VIEW,active:true});}await this.app.workspace.revealLeaf(leaf);}
  onunload(){this.app.workspace.detachLeavesOfType(VIEW);}
}
