import { createBuildSafetyState } from '../building/execution-safety.js'
const now = () => new Date().toISOString()
const label = name => String(name).trim().toLowerCase().replace(/\s+/g, ' ')
const slug = name => label(name).replace(/[^a-z0-9 _-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'project'
export const STAGES = ['planning', 'materials', 'building', 'verification']
export function createProject({name,description=''}) {
  return {id:slug(name),name:String(name).trim(),description,status:'active',stage:'planning',
    materials:{},notes:[],site:null,design:{style:null,constraints:[],reference:null,plan:null},buildSafety:createBuildSafetyState(),
    createdAt:now(),updatedAt:now()}
}
export function addMaterial(project,resource,amount) {
  const key=resource.canonical
  const m=project.materials[key] || {canonical:key,display:resource.display||key.replaceAll('_',' '),target:0,delivered:0,resource}
  m.target+=amount; m.resource=resource; project.materials[key]=m
  if(project.stage==='planning') project.stage='materials'
  project.updatedAt=now(); return project
}
export function recordProjectDelivery(project,resource,amount) {
  const m=project.materials[resource.canonical]
  if(!m) return project
  m.delivered=Math.min(m.target,m.delivered+Math.max(0,amount))
  if(Object.keys(project.materials).length && !projectDeficits(project).length && project.status!=='complete') {
    project.status='materials_ready'
  }
  project.updatedAt=now(); return project
}
export function projectDeficits(project) {
  return Object.values(project.materials).map(m=>({...m,missing:Math.max(0,m.target-m.delivered)}))
    .filter(m=>m.missing>0).sort((a,b)=>b.missing-a.missing)
}
export const nextProjectDeficit=project=>projectDeficits(project)[0]||null
export function projectProgress(project) {
  const materials=Object.values(project.materials)
  const target=materials.reduce((s,m)=>s+m.target,0)
  const delivered=materials.reduce((s,m)=>s+Math.min(m.delivered,m.target),0)
  return {target,delivered,percent:target?Math.round(100*delivered/target):0,deficits:projectDeficits(project)}
}
export function summarizeProject(project) {
  const p=projectProgress(project)
  const missing=p.deficits.slice(0,3).map(m=>`${m.missing} ${m.display}`).join(', ')
  return `${project.name} [${project.stage}]: ${p.percent}% materials ready (${p.delivered}/${p.target}). ${missing?'missing '+missing:'No listed material deficits.'}`
}
export function findProject(projects,name) {
  return Object.values(projects||{}).find(p=>p.id===slug(name)||label(p.name)===label(name))||null
}
export function listProjects(projects) {
  return Object.values(projects||{}).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))
}
export function addProjectNote(project,note) {
  const text=String(note).trim()
  if(!text||text.length>500) throw new Error('INVALID_PROJECT_NOTE')
  project.notes??=[]; project.notes.push({text,at:now()})
  project.notes=project.notes.slice(-100); project.updatedAt=now();return project
}
export function setProjectStage(project,stage) {
  if(!STAGES.includes(stage)) throw new Error('INVALID_PROJECT_STAGE')
  if(project.status==='complete') throw new Error('PROJECT_COMPLETE')
  project.stage=stage;project.updatedAt=now();return project
}
export function setProjectSite(project,position,dimension) {
  project.site={x:Math.floor(position.x),y:Math.floor(position.y),z:Math.floor(position.z),dimension,savedAt:now()}
  project.updatedAt=now();return project
}
export function setDesignConstraint(project,constraint) {
  const text=String(constraint).trim()
  if(!text||text.length>300) throw new Error('INVALID_DESIGN_CONSTRAINT')
  project.design??={style:null,constraints:[],reference:null,plan:null}
  project.design.constraints??=[]
  if(!project.design.constraints.includes(text)) project.design.constraints.push(text)
  project.updatedAt=now();return project
}
export function suggestProjectNext(project) {
  if(project.status==='complete') return 'This project is already marked complete.'
  const deficit=nextProjectDeficit(project)
  if(deficit) return `Collect ${deficit.missing} ${deficit.display} next. Say Milo continue project.`
  if(!project.site) return 'Choose a location. Stand there and say Milo project site here.'
  if(!project.design?.plan) return 'Materials are listed; prepare a build plan and get approval before construction.'
  if(project.stage==='verification') return 'Inspect the planned structure against the actual blocks.'
  return 'Review the build plan; automatic construction is not enabled yet.'
}


export function setProjectReference(project, reference) {
  project.design ??= { style: null, constraints: [], reference: null, plan: null }
  project.design.reference = reference
  project.updatedAt = now()
  return project
}

export function setProjectBuildPlan(project, plan) {
  project.design ??= { style: null, constraints: [], reference: null, plan: null }
  project.design.plan = plan
  project.updatedAt = now()
  return project
}


export function ensureBuildSafety(project) {
  project.buildSafety ??= createBuildSafetyState()
  return project.buildSafety
}
