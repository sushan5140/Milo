import 'dotenv/config'
import mineflayer from 'mineflayer'
import minecraftData from 'minecraft-data'
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder'
import vec3 from 'vec3'
import { MemoryStore } from './memory.js'
import { parseIntent, supportedResources } from './agent/intent.js'
import { inventorySummary, toolClassFor } from './world/inventory.js'
import { gatherResource } from './skills/gathering.js'
import { nearestChest, serializePosition, depositItems, countStoredItems } from './skills/storage.js'
import { smeltResource } from './skills/smelting.js'
import { ensureTool } from './skills/crafting.js'
import { recoverDeathItems } from './safety/recovery.js'
import { verifyHeldGoal, verifyDepositDelta, summarizeVerification } from './agent/verifier.js'
import { withRetries } from './safety/retry.js'
import { createProject, addMaterial, recordProjectDelivery, nextProjectDeficit, summarizeProject, findProject, listProjects, setProjectBuildPlan, setProjectSite, addProjectNote, setDesignConstraint, suggestProjectNext, ensureBuildSafety } from './projects/project.js'
import { createBuildPlan, estimateMaterials, approveBuildPlan, reviseBuildPlan, summarizeBuildPlan, setBuildPalette, replacePaletteBlock } from './building/plan.js'
import { observationsToBuildPlan } from './building/reference-adapter.js'
import { footprintCorners } from './building/preview.js'
import { createImageReference, analyzeReferenceImage } from './building/image-ingest.js'
import { createHttpVisionAnalyzer } from './building/http-vision.js'
import { syncPlanMaterialsToProject } from './building/material-sync.js'
import { verifyPlanAgainstWorld, summarizeWorldVerification } from './building/world-verifier.js'
import { stagePlanRevision, acceptPlanRevision, rejectPlanRevision } from './building/plan-diff.js'
import { addProtectedZone, approveBuildSection, revokeBuildSectionApproval, createRollbackSnapshot, recordRollbackSnapshot, canExecuteSection } from './building/execution-safety.js'
import { flattenExpectedBlocks } from './building/geometry.js'
import { dryRunSection, summarizeDryRun, buildExecutionManifest } from './building/dry-run.js'
import { analyzeBuildSite, summarizeSitePreflight } from './building/site-preflight.js'
import { inventoryReadiness, summarizeInventoryReadiness } from './building/readiness.js'
import { diffRollbackSnapshot, summarizeRollbackPreview } from './building/rollback-preview.js'

const {
  MILO_HOST = 'localhost',
  MILO_PORT = '25565',
  MILO_USERNAME = 'Milo',
  MILO_VERSION = '',
  MILO_AUTH = 'offline',
  MILO_OWNER = '',
  MILO_MEMORY_FILE = './data/memory.json',
  MILO_VISION_ENDPOINT = '',
  MILO_VISION_API_KEY = '',
  MILO_VISION_MODEL = ''
} = process.env

const bot = mineflayer.createBot({
  host: MILO_HOST,
  port: Number(MILO_PORT),
  username: MILO_USERNAME,
  auth: MILO_AUTH,
  ...(MILO_VERSION ? { version: MILO_VERSION } : {})
})

bot.loadPlugin(pathfinder)

const { Vec3 } = vec3

const memory = new MemoryStore(MILO_MEMORY_FILE)
await memory.load()

let owner = MILO_OWNER || memory.get('owner.username') || ''
let mcData = null
let activeTask = null
const visionAnalyzer = MILO_VISION_ENDPOINT
  ? createHttpVisionAnalyzer({ endpoint: MILO_VISION_ENDPOINT, apiKey: MILO_VISION_API_KEY || null, model: MILO_VISION_MODEL || null })
  : null

function say(message) {
  bot.chat(message)
}

function isForMilo(message) {
  return /^milo\b/i.test(message.trim())
}

function stripWakeWord(message) {
  return message.trim().replace(/^milo[,:]?\s*/i, '').trim()
}

function posLabel(position) {
  return `${Math.floor(position.x)}, ${Math.floor(position.y)}, ${Math.floor(position.z)}`
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function pauseActiveTask(reason = 'priority_interrupt') {
  if (!activeTask) return null

  const snapshot = {
    id: activeTask.id,
    intent: activeTask.intent,
    projectId: activeTask.projectId || null,
    reason,
    savedAt: new Date().toISOString()
  }

  activeTask.cancelled = true
  memory.set('tasks.pending', snapshot)
  memory.set('tasks.current', null)
  memory.pushEvent('task_preempted', {
    id: activeTask.id,
    resource: activeTask.resource,
    amount: activeTask.amount,
    reason
  })
  await memory.save()

  bot.pathfinder.stop()
  bot.clearControlStates()

  for (let i = 0; i < 15 && activeTask; i += 1) {
    await sleep(100)
  }

  return snapshot
}

async function goHome() {
  const home = memory.get('places.home')
  if (!home) throw new Error('HOME_UNKNOWN')
  if (home.dimension && home.dimension !== bot.game.dimension) throw new Error('HOME_OTHER_DIMENSION')
  await bot.pathfinder.goto(new goals.GoalNear(home.x, home.y, home.z, 2))
}

function friendlyError(error) {
  const message = String(error?.message || error)

  if (message.startsWith('MISSING_TOOL:')) {
    return `I need a ${message.split(':')[1]} before I can do that.`
  }
  if (message === 'CRAFTING_TABLE_MISSING') return "I need a crafting table nearby before I can make the missing gear."
  if (message.startsWith('TOOL_MATERIALS_MISSING:')) {
    const [, tool, tier] = message.split(':')
    return `I need materials for at least a ${tier} ${tool} before I can do that.`
  }
  if (message.startsWith('TOOL_CRAFT_FAILED:')) return `I couldn't craft ${message.split(':')[1]} safely.`
  if (message === 'FURNACE_MATERIALS_MISSING') return "I need 8 cobblestone and a crafting table before I can make a furnace."
  if (message === 'NO_SAFE_FURNACE_SPOT') return "I couldn't find a safe empty spot to place a furnace without touching your build."
  if (message.startsWith('SURVIVAL_CHECK_FAILED:')) {
    return `I'm not risking it yet — ${message.split(':').slice(1).join(':')}.`
  }
  if (message === 'HOME_UNKNOWN') return "I can gather it, but show me home first with 'Milo remember home'."
  if (message === 'HOME_OTHER_DIMENSION') return "home is in another dimension. cross-dimension return isn't wired yet."
  if (message === 'STORAGE_MISSING') return "the storage I remembered isn't there anymore."
  if (message === 'FURNACE_MISSING') return "I brought the ore back, but I can't find a furnace close enough yet."
  if (message === 'FUEL_MISSING') return "I found a furnace, but I don't have coal or charcoal to smelt this yet."
  if (message === 'FURNACE_BUSY') return "the nearby furnace is busy with something else, so I left it alone."
  if (message === 'SMELT_TIMEOUT') return "the furnace didn't finish normally, so I stopped instead of assuming it worked."
  if (message === 'TASK_CANCELLED') return "stopped. I won't continue that task."
  if (message === 'NO_DEATH_MEMORY') return "I don't have a recent death location to recover from."
  if (message === 'DEATH_MEMORY_STALE') return "that death was too long ago for me to treat the dropped items as recoverable."
  if (message === 'DEATH_OTHER_DIMENSION') return "my last death was in another dimension; cross-dimension recovery isn't safe yet."
  if (message === 'NO_FOOD_LOW_HEALTH') return "my health is too low and I don't have food to recover safely."
  if (message === 'NO_FOOD_LOW_HUNGER') return "I'm too hungry to continue and I don't have food."
  if (message === 'DROWNING_RISK') return "my oxygen is too low; I'm abandoning the task until I'm safe."
  if (message === 'FIRE_RISK') return "I'm on fire or in lava; I'm abandoning the task until I'm safe."
  if (message.startsWith('CANNOT_DIG:')) return `I reached it, but I can't safely dig ${message.split(':')[1]}.`
  return "that task broke somewhere, so I stopped instead of guessing."
}

async function runGatherTask(username, intent, options = {}) {
  const { amount, resource } = intent
  const taskId = options.taskId || `gather-${Date.now()}`
  activeTask = {
    id: taskId,
    type: 'gather',
    resource: resource.canonical,
    amount,
    intent,
    resumed: Boolean(options.resumed),
    projectId: options.projectId || null,
    startedAt: new Date().toISOString()
  }

  memory.set('tasks.current', {
    id: activeTask.id,
    type: activeTask.type,
    resource: activeTask.resource,
    amount: activeTask.amount,
    intent: activeTask.intent,
    projectId: activeTask.projectId,
    startedAt: activeTask.startedAt
  })
  memory.pushEvent(options.resumed ? 'task_resumed' : 'task_started', activeTask)
  await memory.save()

  say(`got it. going for ${amount} ${resource.canonical.replaceAll('_', ' ')}.`)

  try {
    const toolClass = toolClassFor(resource)
    if (!['dirt'].includes(resource.canonical)) {
      const tool = await ensureTool({ bot, mcData, toolClass, resource })
      if (tool.crafted) say(`I was missing a usable ${toolClass}, so I made a ${tool.tool.replaceAll('_', ' ')} first.`)
    }

    let result = null
    for (let planAttempt = 1; planAttempt <= 2; planAttempt += 1) {
      result = await withRetries(
        () => gatherResource({
          bot,
          mcData,
          resource,
          amount,
          onProgress: message => say(message),
          shouldCancel: () => Boolean(activeTask?.cancelled)
        }),
        {
          attempts: 2,
          onRetry: ({ code }) => say(`that route failed with ${code}. trying another way.`)
        }
      )

      if (result.complete) break
      if (activeTask?.cancelled) throw new Error('TASK_CANCELLED')
      if (planAttempt < 2) say(`I only got to ${result.total}. replanning once before I give up.`)
    }

    if (!result.complete) {
      say(`I only got to ${result.total}. I couldn't verify the full amount nearby.`)
    }

    const home = memory.get('places.home')
    if (home) {
      say('heading back.')
      await goHome()
    }

    let deliveryNames = resource.drops
    let deliveryCount = result.total
    let processed = 0

    if (resource.process === 'smelt' && result.total > 0) {
      say(`got the ore. smelting ${Math.min(amount, result.total)} now.`)
      const smelt = await withRetries(
        () => smeltResource({
          bot,
          mcData,
          inputNames: resource.drops,
          outputName: resource.finished[0],
          amount: Math.min(amount, result.total)
        }),
        {
          attempts: 2,
          delayMs: 2000,
          onRetry: ({ code }) => say(`smelting hit ${code}. retrying once.`)
        }
      )
      processed = smelt.produced
      deliveryNames = resource.finished
      deliveryCount = smelt.produced
    }

    const storage = memory.get('storage.default')
    let deposited = 0
    let verification = null

    if (storage && storage.dimension === bot.game.dimension) {
      const depositCount = Math.min(amount, deliveryCount)
      const beforeStored = await countStoredItems({ bot, storage, itemNames: deliveryNames })

      const deposit = await withRetries(
        () => depositItems({
          bot,
          storage,
          itemNames: deliveryNames,
          count: depositCount
        }),
        {
          attempts: 2,
          onRetry: ({ code }) => say(`storage step hit ${code}. retrying once.`)
        }
      )
      deposited = deposit.deposited

      const afterStored = await countStoredItems({ bot, storage, itemNames: deliveryNames })
      verification = verifyDepositDelta({
        before: beforeStored,
        after: afterStored,
        requested: amount
      })
    } else {
      verification = verifyHeldGoal(bot, deliveryNames, amount)
    }

    const outcome = {
      id: taskId,
      requested: amount,
      resource: resource.canonical,
      gathered: result.gathered,
      processed,
      totalHeld: deliveryCount,
      deposited,
      complete: Boolean(verification?.complete),
      verification,
      projectId: activeTask?.projectId || options.projectId || null,
      finishedAt: new Date().toISOString()
    }

    if (outcome.projectId && verification) {
      const project = memory.get(`projects.${outcome.projectId}`)
      if (project) {
        const verifiedDelivery = verification.delta ?? (verification.complete ? amount : 0)
        if (verifiedDelivery > 0) {
          recordProjectDelivery(project, resource, verifiedDelivery)
          memory.set(`projects.${outcome.projectId}`, project)
          memory.pushEvent('project_material_delivered', {
            projectId: outcome.projectId,
            resource: resource.canonical,
            amount: verifiedDelivery
          })
        }
      }
    }

    if (outcome.complete) {
      memory.set('tasks.pending', null)
      memory.set('tasks.current', null)
      memory.pushEvent('task_completed', outcome)
    } else {
      memory.set('tasks.pending', {
        id: taskId,
        intent,
        reason: 'verification_failed',
        verification,
        projectId: activeTask?.projectId || options.projectId || null,
        savedAt: new Date().toISOString()
      })
      memory.set('tasks.current', null)
      memory.pushEvent('task_incomplete', outcome)
    }
    await memory.save()

    if (deposited > 0 && verification?.complete) {
      say(`back. I put ${deposited} ${resource.display || resource.canonical.replaceAll('_', ' ')} in storage — ${summarizeVerification(verification)}.`)
    } else if (deposited > 0) {
      say(`I deposited some, but the goal didn't verify: ${summarizeVerification(verification)}. say 'Milo resume' and I'll continue.`)
    } else if (home) {
      say(`back home. I've got ${deliveryCount} ${resource.display || resource.canonical.replaceAll('_', ' ')} on me — show me a chest with 'Milo remember storage' and I'll use it next time.`)
    } else {
      say(`done for now. I've got ${deliveryCount} on me. you haven't shown me home yet.`)
    }
  } catch (error) {
    const reason = String(error?.message || error)
    memory.set('tasks.current', null)
    memory.set('tasks.pending', {
      id: taskId,
      intent,
      projectId: activeTask?.projectId || options.projectId || null,
      reason,
      savedAt: new Date().toISOString()
    })
    memory.pushEvent(reason === 'TASK_CANCELLED' ? 'task_paused' : 'task_failed', {
      id: taskId,
      resource: resource.canonical,
      amount,
      error: reason
    })
    await memory.save()
    console.error('[Milo] Gather task failed:', error)
    say(friendlyError(error))
    if (reason === 'TASK_CANCELLED') say("I saved the task. say 'Milo resume' whenever you want me to continue.")
  } finally {
    activeTask = null
  }
}

bot.once('spawn', async () => {
  mcData = minecraftData(bot.version)
  bot.pathfinder.setMovements(new Movements(bot, mcData))
  console.log(`[Milo] Spawned on ${MILO_HOST}:${MILO_PORT} as ${MILO_USERNAME} (${bot.version})`)
  if (owner) console.log(`[Milo] Owner: ${owner}`)
})

bot.on('chat', async (username, message) => {
  if (username === bot.username || !isForMilo(message)) return

  if (!owner) {
    owner = username
    memory.set('owner.username', username)
    await memory.save()
    say(`alright ${username}, you're my owner now.`)
  }

  if (username !== owner) {
    say(`I'm currently paired with ${owner}.`)
    return
  }

  const rawIntent = stripWakeWord(message)
  const normalized = rawIntent.toLowerCase()

  try {
    const startProjectMatch = normalized.match(/^start project\s+(.+)$/)
    if (startProjectMatch) {
      const name = startProjectMatch[1].trim()
      const project = createProject({ name })
      memory.set(`projects.${project.id}`, project)
      memory.set('projectState.activeId', project.id)
      memory.pushEvent('project_started', { id: project.id, name: project.name })
      await memory.save()
      say(`project "${project.name}" started. add materials like: Milo project needs 128 spruce.`)
      return
    }

    const activeProjectId = memory.get('projectState.activeId')
    const activeProject = activeProjectId ? memory.get(`projects.${activeProjectId}`) : null

    const projectNoteMatch = normalized.match(/^project note\s+(.+)$/)
    if (projectNoteMatch) {
      if (!activeProject) {
        say("there's no active project.")
        return
      }
      addProjectNote(activeProject, projectNoteMatch[1])
      memory.set(`projects.${activeProject.id}`, activeProject)
      await memory.save()
      say("saved that project note.")
      return
    }

    const projectConstraintMatch = normalized.match(/^project constraint\s+(.+)$/)
    if (projectConstraintMatch) {
      if (!activeProject) {
        say("there's no active project.")
        return
      }
      setDesignConstraint(activeProject, projectConstraintMatch[1])
      memory.set(`projects.${activeProject.id}`, activeProject)
      await memory.save()
      say("saved that design constraint.")
      return
    }

    if (/^project site here$/.test(normalized)) {
      if (!activeProject) {
        say("there's no active project.")
        return
      }
      setProjectSite(activeProject, bot.entity.position, bot.game.dimension)
      memory.set(`projects.${activeProject.id}`, activeProject)
      await memory.save()
      say(`saved this as the site for ${activeProject.name}: ${posLabel(bot.entity.position)}.`)
      return
    }

    if (/^(project next|what next for project|project suggestion)$/.test(normalized)) {
      if (!activeProject) {
        say("there's no active project.")
        return
      }
      say(suggestProjectNext(activeProject))
      return
    }

    const buildPlanMatch = normalized.match(/^plan build\s+(\d+)x(\d+)x(\d+)(?:\s+style\s+(.+))?$/)
    if (buildPlanMatch) {
      if (!activeProject) {
        say("start or select a project first.")
        return
      }

      const width = Number(buildPlanMatch[1])
      const length = Number(buildPlanMatch[2])
      const height = Number(buildPlanMatch[3])
      const style = buildPlanMatch[4] || activeProject.design?.style || 'unspecified'

      const plan = createBuildPlan({ width, length, height, style })
      estimateMaterials(plan)
      setProjectBuildPlan(activeProject, plan)
      memory.set(`projects.${activeProject.id}`, activeProject)
      memory.pushEvent('build_plan_created', { projectId: activeProject.id, width, length, height, style })
      await memory.save()
      say(`draft build plan created for ${activeProject.name}: ${summarizeBuildPlan(plan)}. nothing will be built until the plan is approved.`)
      return
    }

    const reviseBuildMatch = normalized.match(/^revise build\s+(width|length|height)\s+(\d+)$/)
    if (reviseBuildMatch) {
      if (!activeProject?.design?.plan) {
        say("there's no build plan to revise.")
        return
      }
      const field = reviseBuildMatch[1]
      const value = Number(reviseBuildMatch[2])
      reviseBuildPlan(activeProject.design.plan, { [field]: value })
      estimateMaterials(activeProject.design.plan)
      memory.set(`projects.${activeProject.id}`, activeProject)
      await memory.save()
      say(`updated. ${summarizeBuildPlan(activeProject.design.plan)}`)
      return
    }

    const imageReferenceMatch = rawIntent.match(/^image reference\s+(https?:\/\/\S+)$/i)
    if (imageReferenceMatch) {
      if (!activeProject) {
        say("start or select a project first.")
        return
      }

      const reference = createImageReference({
        source: imageReferenceMatch[1],
        kind: 'url',
        metadata: { addedBy: username }
      })

      activeProject.design ??= {}
      activeProject.design.reference = reference
      memory.set(`projects.${activeProject.id}`, activeProject)
      memory.pushEvent('project_image_reference_added', {
        projectId: activeProject.id,
        source: reference.source
      })
      await memory.save()
      say("saved the reference image URL for this project.")
      return
    }

    if (/^analyze reference$/.test(normalized)) {
      if (!activeProject?.design?.reference) {
        say("there's no image reference saved for this project.")
        return
      }
      if (!visionAnalyzer) {
        say("the image reference is saved, but no vision analyzer endpoint is configured yet.")
        return
      }

      say("analyzing the saved build reference.")
      const observations = await analyzeReferenceImage(activeProject.design.reference, visionAnalyzer)
      const plan = observationsToBuildPlan(observations)

      if (activeProject.design?.plan) {
        const pending = stagePlanRevision(activeProject, plan)
        memory.set(`projects.${activeProject.id}`, activeProject)
        memory.pushEvent('project_reference_revision_staged', {
          projectId: activeProject.id,
          changeCount: pending.diff.changes.length
        })
        await memory.save()
        say(`reference analysis found ${pending.diff.changes.length} plan changes. I staged them instead of replacing the current plan. say 'Milo accept plan revision' or 'Milo reject plan revision'.`)
        return
      }

      setProjectBuildPlan(activeProject, plan)
      memory.set(`projects.${activeProject.id}`, activeProject)
      memory.pushEvent('project_reference_analyzed', {
        projectId: activeProject.id,
        style: plan.style,
        footprint: plan.footprint,
        height: plan.height,
        confidence: plan.reference?.confidence ?? null
      })
      await memory.save()
      say(`reference analyzed into a draft plan: ${summarizeBuildPlan(plan)}`)
      return
    }

    if (/^accept plan revision$/.test(normalized)) {
      if (!activeProject?.design?.pendingRevision) {
        say("there's no pending plan revision.")
        return
      }
      const plan = acceptPlanRevision(activeProject)
      memory.set(`projects.${activeProject.id}`, activeProject)
      memory.pushEvent('build_plan_revision_accepted', { projectId: activeProject.id })
      await memory.save()
      say(`revision accepted as a new draft: ${summarizeBuildPlan(plan)}. approval is intentionally reset.`)
      return
    }

    if (/^reject plan revision$/.test(normalized)) {
      if (!activeProject?.design?.pendingRevision) {
        say("there's no pending plan revision.")
        return
      }
      rejectPlanRevision(activeProject)
      memory.set(`projects.${activeProject.id}`, activeProject)
      memory.pushEvent('build_plan_revision_rejected', { projectId: activeProject.id })
      await memory.save()
      say("revision rejected. keeping the current plan unchanged.")
      return
    }

    if (/^(plan revision|show plan revision)$/.test(normalized)) {
      const pending = activeProject?.design?.pendingRevision
      if (!pending) {
        say("there's no pending plan revision.")
        return
      }
      say(`${pending.diff.summary}. approval would be invalidated: ${pending.diff.approvalInvalidated ? 'yes' : 'no'}.`)
      return
    }

    const protectRadiusMatch = normalized.match(/^protect build area\s+(.+?)\s+radius\s+(\d+)$/)
    if (protectRadiusMatch) {
      if (!activeProject) {
        say("there's no active project.")
        return
      }

      const radius = Math.min(Math.max(Number(protectRadiusMatch[2]), 1), 128)
      const p = bot.entity.position
      const safety = ensureBuildSafety(activeProject)
      const zone = addProtectedZone(safety, {
        name: protectRadiusMatch[1],
        min: { x: Math.floor(p.x) - radius, y: Math.floor(p.y) - radius, z: Math.floor(p.z) - radius },
        max: { x: Math.floor(p.x) + radius, y: Math.floor(p.y) + radius, z: Math.floor(p.z) + radius },
        dimension: bot.game.dimension
      })

      memory.set(`projects.${activeProject.id}`, activeProject)
      await memory.save()
      say(`protected zone "${zone.name}" saved. future build execution must not modify blocks inside it.`)
      return
    }

    const approveSectionMatch = normalized.match(/^approve build section\s+(\S+)$/)
    if (approveSectionMatch) {
      if (!activeProject) {
        say("there's no active project.")
        return
      }
      const safety = ensureBuildSafety(activeProject)
      approveBuildSection(safety, approveSectionMatch[1], username)
      memory.set(`projects.${activeProject.id}`, activeProject)
      await memory.save()
      say(`section ${approveSectionMatch[1]} approved, but the executor itself is still disabled.`)
      return
    }

    const revokeSectionMatch = normalized.match(/^revoke build section\s+(\S+)$/)
    if (revokeSectionMatch) {
      if (!activeProject) {
        say("there's no active project.")
        return
      }
      const safety = ensureBuildSafety(activeProject)
      revokeBuildSectionApproval(safety, revokeSectionMatch[1])
      memory.set(`projects.${activeProject.id}`, activeProject)
      await memory.save()
      say(`section ${revokeSectionMatch[1]} approval revoked.`)
      return
    }

    const rollbackMatch = normalized.match(/^snapshot build section\s+(\S+)$/)
    if (rollbackMatch) {
      if (!activeProject?.design?.plan || !activeProject?.site) {
        say("I need both a build plan and project site first.")
        return
      }

      const sectionId = rollbackMatch[1]
      const expected = flattenExpectedBlocks(activeProject.design.plan, activeProject.site)
        .filter(item => item.role === sectionId || item.role === sectionId.replace(/s$/, ''))

      if (!expected.length) {
        say(`I couldn't map section "${sectionId}" to planned positions.`)
        return
      }

      const positions = expected.slice(0, 2048).map(item => {
        const block = bot.blockAt(new Vec3(item.x, item.y, item.z))
        return {
          x: item.x, y: item.y, z: item.z,
          before: block ? { name: block.name, stateId: block.stateId ?? null } : null
        }
      })

      const safety = ensureBuildSafety(activeProject)
      const snapshot = createRollbackSnapshot({
        projectId: activeProject.id,
        sectionId,
        positions
      })
      recordRollbackSnapshot(safety, snapshot)
      memory.set(`projects.${activeProject.id}`, activeProject)
      await memory.save()
      say(`saved rollback metadata for ${positions.length} positions in section ${sectionId}.`)
      return
    }

    if (/^(site preflight|check build site|preflight build site)$/.test(normalized)) {
      if (!activeProject?.design?.plan || !activeProject?.site) {
        say("I need both a build plan and a project site first.")
        return
      }
      if (activeProject.site.dimension !== bot.game.dimension) {
        say("the project site is in another dimension.")
        return
      }

      const result = analyzeBuildSite(bot, activeProject)
      activeProject.buildSafety ??= {}
      activeProject.buildSafety.lastSitePreflight = {
        ...result,
        checkedAt: new Date().toISOString()
      }
      memory.set(`projects.${activeProject.id}`, activeProject)
      memory.pushEvent('build_site_preflight', {
        projectId: activeProject.id,
        safe: result.safe,
        liquids: result.liquids,
        blockedClearance: result.blockedClearance,
        nearbyEntities: result.nearbyEntities
      })
      await memory.save()
      say(`${summarizeSitePreflight(result)} | 0 blocks changed`)
      return
    }

    const readinessMatch = normalized.match(/^section readiness(?:\s+(\S+))?$/)
    if (readinessMatch) {
      if (!activeProject?.buildSafety?.lastManifest) {
        say("run a dry build first so I know the exact placement list.")
        return
      }
      const section = readinessMatch[1] || activeProject.buildSafety.lastManifest.sectionId || 'all'
      const result = inventoryReadiness(bot, activeProject, section)
      say(summarizeInventoryReadiness(result))
      return
    }

    const rollbackPreviewMatch = normalized.match(/^rollback preview(?:\s+(\S+))?$/)
    if (rollbackPreviewMatch) {
      if (!activeProject?.buildSafety?.rollbackLog?.length) {
        say("there's no rollback snapshot yet.")
        return
      }
      if (!activeProject?.buildSafety?.lastManifest) {
        say("there's no dry-run manifest to compare against.")
        return
      }

      const requestedSection = rollbackPreviewMatch[1] || activeProject.buildSafety.lastManifest.sectionId
      const snapshot = [...activeProject.buildSafety.rollbackLog].reverse()
        .find(s => s.sectionId === requestedSection)

      if (!snapshot) {
        say(`there's no rollback snapshot for section ${requestedSection}.`)
        return
      }

      const result = diffRollbackSnapshot(snapshot, activeProject.buildSafety.lastManifest)
      activeProject.buildSafety.lastRollbackPreview = {
        snapshotId: result.snapshotId,
        sectionId: result.sectionId,
        compared: result.compared,
        wouldChange: result.wouldChange,
        blocked: result.blocked,
        alreadyCorrect: result.alreadyCorrect,
        checkedAt: new Date().toISOString()
      }
      memory.set(`projects.${activeProject.id}`, activeProject)
      await memory.save()
      say(`${summarizeRollbackPreview(result)} This is preview-only.`)
      return
    }

        const dryRunMatch = normalized.match(/^dry run build(?:\s+(\S+))?$/)
    if (dryRunMatch) {
      if (!activeProject?.design?.plan || !activeProject?.site) {
        say("I need both a build plan and a project site first.")
        return
      }
      if (activeProject.site.dimension !== bot.game.dimension) {
        say("the project site is in another dimension.")
        return
      }

      const section = dryRunMatch[1] || 'all'
      const result = dryRunSection({
        bot,
        project: activeProject,
        sectionId: section,
        sampleLimit: 10000
      })

      const manifest = buildExecutionManifest(result)
      activeProject.buildSafety ??= {}
      activeProject.buildSafety.lastDryRun = {
        sectionId: section,
        summary: manifest.summary,
        blocked: result.blocked,
        generatedAt: manifest.generatedAt
      }
      activeProject.buildSafety.lastManifest = manifest
      memory.set(`projects.${activeProject.id}`, activeProject)
      memory.pushEvent('build_dry_run', {
        projectId: activeProject.id,
        sectionId: section,
        summary: manifest.summary,
        blocked: result.blocked
      })
      await memory.save()
      say(summarizeDryRun(result))
      return
    }

    const manifestSummaryMatch = normalized.match(/^build manifest(?:\s+(\S+))?$/)
    if (manifestSummaryMatch) {
      if (!activeProject?.buildSafety?.lastManifest) {
        say("there's no dry-run manifest yet. use 'Milo dry run build'.")
        return
      }

      const manifest = activeProject.buildSafety.lastManifest
      const counts = manifest.summary
      const blocked = manifest.actions.filter(a => a.action === 'blocked').slice(0, 3)
      const blockedText = blocked.length
        ? blocked.map(a => `${a.reason} at ${a.x},${a.y},${a.z}`).join('; ')
        : 'no blocked placements'

      say(`${manifest.sectionId} manifest: ${counts.total} planned, ${counts.placeable} placeable, ${counts.alreadyCorrect} already correct. ${blockedText}. execution remains disabled.`)
      return
    }

        const executorStatusMatch = normalized.match(/^executor status(?:\s+(\S+))?$/)
    if (executorStatusMatch) {
      if (!activeProject) {
        say("there's no active project.")
        return
      }
      const section = executorStatusMatch[1] || 'walls'
      const gate = canExecuteSection(ensureBuildSafety(activeProject), section)
      say(`executor enabled: ${gate.executionEnabled ? 'yes' : 'no'}; section ${section} approved: ${gate.sectionApproved ? 'yes' : 'no'}; allowed now: ${gate.allowed ? 'yes' : 'no'}.`)
      return
    }

        if (/^(sync build materials|sync plan materials)$/.test(normalized)) {
      if (!activeProject?.design?.plan) {
        say("there's no build plan to sync.")
        return
      }

      const result = syncPlanMaterialsToProject(activeProject, activeProject.design.plan, parseIntent)
      memory.set(`projects.${activeProject.id}`, activeProject)
      memory.pushEvent('build_materials_synced', {
        projectId: activeProject.id,
        resourceLines: result.bill.length,
        unresolved: result.unresolved
      })
      await memory.save()

      const unresolved = result.unresolved.length
      say(`synced the build plan into ${result.bill.length} resource lines${unresolved ? `; ${unresolved} block types still need crafting/resource mappings` : ''}.`)
      return
    }

    if (/^(verify build|verify build plan against world)$/.test(normalized)) {
      if (!activeProject?.design?.plan) {
        say("there's no build plan to verify.")
        return
      }
      if (!activeProject.site) {
        say("set the project site first.")
        return
      }
      if (activeProject.site.dimension !== bot.game.dimension) {
        say("the project site is in another dimension.")
        return
      }

      const result = verifyPlanAgainstWorld(bot, activeProject.design.plan, activeProject.site, { sampleLimit: 512 })
      activeProject.design.lastVerification = {
        checked: result.checked,
        matches: result.matches,
        mismatchCount: result.mismatches.length,
        matchRate: result.matchRate,
        at: new Date().toISOString()
      }
      memory.set(`projects.${activeProject.id}`, activeProject)
      memory.pushEvent('build_world_verified', {
        projectId: activeProject.id,
        checked: result.checked,
        matches: result.matches,
        mismatchCount: result.mismatches.length
      })
      await memory.save()
      say(`${summarizeWorldVerification(result)} This check was read-only.`)
      return
    }

        const paletteMatch = normalized.match(/^build palette\s+(.+)$/)
    if (paletteMatch) {
      if (!activeProject?.design?.plan) {
        say("there's no build plan yet.")
        return
      }

      const entries = paletteMatch[1].split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
          const [blockRaw, ratioRaw] = part.split('=').map(v => v.trim())
          const ratio = Number(ratioRaw)
          if (!blockRaw || !Number.isFinite(ratio) || ratio < 0) return null
          return { block: blockRaw, ratio }
        })
        .filter(Boolean)

      if (!entries.length) {
        say("use: Milo build palette spruce_planks=60, stone_bricks=40")
        return
      }

      setBuildPalette(activeProject.design.plan, entries)
      memory.set(`projects.${activeProject.id}`, activeProject)
      await memory.save()
      say(`palette updated. ${summarizeBuildPlan(activeProject.design.plan)}`)
      return
    }

    const paletteReplaceMatch = normalized.match(/^replace palette\s+(\S+)\s+with\s+(\S+)$/)
    if (paletteReplaceMatch) {
      if (!activeProject?.design?.plan) {
        say("there's no build plan yet.")
        return
      }

      replacePaletteBlock(activeProject.design.plan, paletteReplaceMatch[1], paletteReplaceMatch[2])
      memory.set(`projects.${activeProject.id}`, activeProject)
      await memory.save()
      say(`replaced ${paletteReplaceMatch[1]} with ${paletteReplaceMatch[2]}. approval was reset because the plan changed.`)
      return
    }

    const referenceObservationMatch = normalized.match(/^reference plan\s+(\d+)x(\d+)x(\d+)(?:\s+style\s+(.+))?$/)
    if (referenceObservationMatch) {
      if (!activeProject) {
        say("start or select a project first.")
        return
      }

      const plan = observationsToBuildPlan({
        width: Number(referenceObservationMatch[1]),
        length: Number(referenceObservationMatch[2]),
        height: Number(referenceObservationMatch[3]),
        style: referenceObservationMatch[4] || 'unspecified',
        source: 'manual-reference-observations',
        confidence: 1
      })

      setProjectBuildPlan(activeProject, plan)
      memory.set(`projects.${activeProject.id}`, activeProject)
      memory.pushEvent('reference_plan_created', {
        projectId: activeProject.id,
        footprint: plan.footprint,
        height: plan.height,
        style: plan.style
      })
      await memory.save()
      say(`reference observations converted into a draft plan: ${summarizeBuildPlan(plan)}`)
      return
    }

    if (/^(preview footprint|walk footprint|preview build footprint)$/.test(normalized)) {
      if (!activeProject?.design?.plan) {
        say("there's no build plan yet.")
        return
      }
      if (!activeProject.site) {
        say("set the project site first with 'Milo project site here'.")
        return
      }
      if (activeProject.site.dimension !== bot.game.dimension) {
        say("the project site is in another dimension.")
        return
      }

      const corners = footprintCorners(activeProject.site, activeProject.design.plan.footprint)
      say(`walking the ${activeProject.design.plan.footprint.width}x${activeProject.design.plan.footprint.length} footprint corners. I won't place or break anything.`)

      for (const corner of corners) {
        await bot.pathfinder.goto(new goals.GoalNear(corner.x, corner.y, corner.z, 2))
        await sleep(500)
      }

      await bot.pathfinder.goto(new goals.GoalNear(corners[0].x, corners[0].y, corners[0].z, 2))
      say("footprint preview complete. no blocks were changed.")
      return
    }

        if (/^(build plan|show build plan)$/.test(normalized)) {
      if (!activeProject?.design?.plan) {
        say("there's no build plan yet.")
        return
      }
      say(summarizeBuildPlan(activeProject.design.plan))
      return
    }

    if (/^approve build plan$/.test(normalized)) {
      if (!activeProject?.design?.plan) {
        say("there's no build plan to approve.")
        return
      }
      approveBuildPlan(activeProject.design.plan)
      memory.set(`projects.${activeProject.id}`, activeProject)
      memory.pushEvent('build_plan_approved', { projectId: activeProject.id })
      await memory.save()
      say("build plan approved. automatic construction is still locked until live-world verification is complete.")
      return
    }

        const projectNeedsMatch = normalized.match(/^project needs\s+(\d+)\s+(.+)$/)
    if (projectNeedsMatch) {
      const activeId = memory.get('projectState.activeId')
      const project = activeId ? memory.get(`projects.${activeId}`) : null
      if (!project) {
        say("start a project first with 'Milo start project <name>'.")
        return
      }

      const amount = Math.min(Math.max(Number(projectNeedsMatch[1]), 1), 2304)
      const materialIntent = parseIntent(`get ${amount} ${projectNeedsMatch[2]}`)
      if (materialIntent.type !== 'gather') {
        say(`I don't know that material yet. say 'Milo resources' for the current resource list.`)
        return
      }

      addMaterial(project, materialIntent.resource, amount)
      memory.set(`projects.${project.id}`, project)
      memory.pushEvent('project_material_added', {
        projectId: project.id,
        resource: materialIntent.resource.canonical,
        amount
      })
      await memory.save()
      say(`added ${amount} ${materialIntent.resource.display || materialIntent.resource.canonical} to ${project.name}. ${summarizeProject(project)}`)
      return
    }

    if (/^(projects|list projects)$/.test(normalized)) {
      const projects = listProjects(memory.get('projects') || {})
      if (!projects.length) {
        say("you don't have any projects yet.")
        return
      }

      const activeId = memory.get('projectState.activeId')
      const summary = projects.slice(0, 5)
        .map(project => `${project.id === activeId ? '*' : ''}${project.name} [${project.status}]`)
        .join(', ')
      say(`projects: ${summary}`)
      return
    }

    const completeProjectMatch = normalized.match(/^(?:complete|finish) project(?:\s+(.+))?$/)
    if (completeProjectMatch) {
      const projects = memory.get('projects') || {}
      const explicit = completeProjectMatch[1]?.trim()
      const activeId = memory.get('projectState.activeId')
      const project = explicit ? findProject(projects, explicit) : (activeId ? projects[activeId] : null)

      if (!project) {
        say(explicit ? `I don't know a project called "${explicit}".` : "there's no active project to finish.")
        return
      }

      project.status = 'complete'
      project.updatedAt = new Date().toISOString()
      memory.set(`projects.${project.id}`, project)
      if (activeId === project.id) memory.set('projectState.activeId', null)
      memory.pushEvent('project_completed', { projectId: project.id, name: project.name })
      await memory.save()
      say(`${project.name} marked complete.`)
      return
    }

        const projectStatusMatch = normalized.match(/^project status(?:\s+(.+))?$/)
    if (projectStatusMatch) {
      const projects = memory.get('projects') || {}
      const explicit = projectStatusMatch[1]?.trim()
      const activeId = memory.get('projectState.activeId')
      const project = explicit ? findProject(projects, explicit) : (activeId ? projects[activeId] : null)

      if (!project) {
        say(explicit ? `I don't know a project called "${explicit}".` : "there's no active project yet.")
        return
      }

      say(summarizeProject(project))
      return
    }

    const useProjectMatch = normalized.match(/^(?:use|switch to) project\s+(.+)$/)
    if (useProjectMatch) {
      const projects = memory.get('projects') || {}
      const project = findProject(projects, useProjectMatch[1])
      if (!project) {
        say(`I don't know a project called "${useProjectMatch[1]}".`)
        return
      }

      memory.set('projectState.activeId', project.id)
      await memory.save()
      say(`okay, ${project.name} is the active project. ${summarizeProject(project)}`)
      return
    }

    if (/^(continue project|work on project|continue the project)$/.test(normalized)) {
      if (activeTask) {
        say("I'm already working on something. stop or replace that task first.")
        return
      }

      const activeId = memory.get('projectState.activeId')
      const project = activeId ? memory.get(`projects.${activeId}`) : null
      if (!project) {
        say("there's no active project to continue.")
        return
      }

      const deficit = nextProjectDeficit(project)
      if (!deficit) {
        say(`${project.name} has all listed materials ready. the next phase is construction planning.`)
        return
      }

      const intent = {
        type: 'gather',
        amount: deficit.missing,
        requested: deficit.display,
        resource: deficit.resource
      }

      say(`continuing ${project.name}. next bottleneck is ${deficit.missing} ${deficit.display}.`)
      void runGatherTask(username, intent, { projectId: project.id })
      return
    }

    const replacementMatch = normalized.match(/^(?:forget|drop|cancel|stop).+?\b((?:get|grab|bring|fetch|mine|collect)(?: me)?\s+.+?)(?:\s+instead)?$/)

    if (replacementMatch) {
      const replacementText = replacementMatch[1].replace(/\s+instead$/, '')
      const nextIntent = parseIntent(replacementText)

      if (nextIntent.type !== 'gather') {
        say("I understood that you want to replace the task, but I couldn't understand the new resource request.")
        return
      }

      if (activeTask) {
        activeTask.cancelled = true
        bot.pathfinder.stop()
        bot.clearControlStates()

        for (let i = 0; i < 20 && activeTask; i += 1) {
          await sleep(100)
        }
      }

      memory.set('tasks.pending', null)
      memory.set('tasks.current', null)
      memory.pushEvent('task_replaced', {
        with: {
          amount: nextIntent.amount,
          resource: nextIntent.resource.canonical
        },
        at: new Date().toISOString()
      })
      await memory.save()

      say(`okay, dropping the old job. switching to ${nextIntent.amount} ${nextIntent.resource.display || nextIntent.resource.canonical}.`)
      void runGatherTask(username, nextIntent)
      return
    }

    if (/^(resume|resume task|continue task|continue)$/.test(normalized)) {
      if (activeTask) {
        say("I'm already working on something.")
        return
      }

      const pending = memory.get('tasks.pending')
      if (!pending?.intent) {
        say("I don't have a paused task to resume.")
        return
      }

      let resumeIntent = pending.intent

      if (pending.projectId) {
        const project = memory.get(`projects.${pending.projectId}`)
        const material = project?.materials?.[pending.intent.resource.canonical]
        if (project && material) {
          const missing = Math.max(0, material.target - material.delivered)
          if (missing === 0) {
            memory.set('tasks.pending', null)
            await memory.save()
            say(`${project.name} already has enough ${material.display}; there is nothing left to resume for that material.`)
            return
          }
          resumeIntent = { ...pending.intent, amount: missing }
        }
      }

      say(`resuming the ${resumeIntent.amount} ${resumeIntent.resource.display || resumeIntent.resource.canonical} task.`)
      void runGatherTask(username, resumeIntent, {
        taskId: pending.id,
        resumed: true,
        projectId: pending.projectId || null
      })
      return
    }

    if (/^(stop|cancel|stop task|cancel task)$/.test(normalized)) {
      if (!activeTask) {
        say("I'm not doing anything right now.")
        return
      }
      activeTask.cancelled = true
      bot.pathfinder.stop()
      bot.clearControlStates()
      say("stopping.")
      return
    }

    if (/^(recover|recover items|recover my items|get my items|death recovery)$/.test(normalized)) {
      if (activeTask) {
        say("I'm already working on something. stop that task first.")
        return
      }

      const death = memory.get('recovery.lastDeath')
      say("going back to my last death spot to look for dropped items.")
      const result = await recoverDeathItems({ bot, death })
      memory.pushEvent('death_recovery_attempted', {
        death,
        approached: result.approached,
        recovered: result.recovered,
        recoveredCount: result.recoveredCount,
        verified: result.verified
      })
      await memory.save()

      if (result.verified) {
        const summary = Object.entries(result.recovered)
          .slice(0, 5)
          .map(([name, count]) => `${count} ${name}`)
          .join(', ')
        say(`recovery verified. I picked up ${result.recoveredCount} items${summary ? `: ${summary}` : '.'}`)
      } else {
        say("I reached the death spot, but my inventory didn't increase, so I can't claim I recovered anything.")
      }
      return
    }

    if (/^(come|come here|follow me|help me|come help me|come here now)$/.test(normalized)) {
      const target = bot.players[username]?.entity
      if (!target) {
        say("I can't see you right now.")
        return
      }

      if (activeTask) {
        const paused = await pauseActiveTask('player_priority')
        if (paused) say("pausing that job — coming to you now.")
      } else {
        say('coming.')
      }

      await bot.pathfinder.goto(new goals.GoalNear(target.position.x, target.position.y, target.position.z, 2))
      say("I'm here. the previous task is saved if you want me to resume it.")
      return
    }

    if (/^status$/.test(normalized)) {
      const home = memory.get('places.home')
      const storage = memory.get('storage.default')
      const task = activeTask ? `busy with ${activeTask.amount} ${activeTask.resource}` : 'idle'
      say(`I'm at ${posLabel(bot.entity.position)}. ${task}. home: ${home ? 'known' : 'unknown'}, storage: ${storage ? 'known' : 'unknown'}.`)
      return
    }

    if (/^inventory$/.test(normalized)) {
      const summary = inventorySummary(bot)
      const top = Object.entries(summary).slice(0, 8).map(([name, count]) => `${count} ${name}`).join(', ')
      say(top ? `I've got ${top}${Object.keys(summary).length > 8 ? ', and more.' : '.'}` : "my inventory is empty.")
      return
    }

    if (/^(remember|set) home$/.test(normalized)) {
      const p = bot.entity.position
      memory.set('places.home', {
        x: Math.floor(p.x),
        y: Math.floor(p.y),
        z: Math.floor(p.z),
        dimension: bot.game.dimension,
        savedAt: new Date().toISOString()
      })
      await memory.save()
      say("got it. I'll remember this as home.")
      return
    }

    if (/^(remember|set) storage$/.test(normalized)) {
      const chest = nearestChest(bot, 8)
      if (!chest) {
        say("I don't see a chest or barrel close enough. stand near the one you want me to use.")
        return
      }

      memory.set('storage.default', serializePosition(chest, bot.game.dimension))
      await memory.save()
      say(`got it. I'll use the ${chest.name.replace('_', ' ')} at ${posLabel(chest.position)} as our default storage.`)
      return
    }

    if (/^(where is|where's) home$/.test(normalized)) {
      const home = memory.get('places.home')
      if (!home) {
        say("you haven't shown me home yet.")
        return
      }
      say(`home is at ${home.x}, ${home.y}, ${home.z}.`)
      return
    }

    if (/^(go|return) home$/.test(normalized)) {
      if (activeTask) {
        say("I'm already working on something.")
        return
      }
      say('heading home.')
      await goHome()
      say("I'm home.")
      return
    }

    if (/^(resources|what can you get|what can you mine)$/.test(normalized)) {
      say(`right now I understand: ${supportedResources().join(', ')}.`)
      return
    }

    const parsed = parseIntent(normalized)

    if (parsed.type === 'unknown_resource') {
      say(`I don't know how to gather ${parsed.requested} yet. say 'Milo resources' for my current list.`)
      return
    }

    if (parsed.type === 'gather') {
      if (activeTask) {
        say(`I'm already busy getting ${activeTask.amount} ${activeTask.resource}.`)
        return
      }
      void runGatherTask(username, parsed)
      return
    }

    say("I heard you. try 'Milo get me 12 coal', 'Milo remember storage', 'Milo inventory', or 'Milo status'.")
  } catch (error) {
    console.error('[Milo] Action failed:', error)
    say(friendlyError(error))
  }
})

bot.on('death', async () => {
  const p = bot.entity?.position
  if (!p) return

  const death = {
    x: Math.floor(p.x),
    y: Math.floor(p.y),
    z: Math.floor(p.z),
    dimension: bot.game?.dimension,
    at: new Date().toISOString()
  }

  memory.set('recovery.lastDeath', death)
  memory.pushEvent('death', death)

  if (activeTask) {
    activeTask.cancelled = true
    memory.set('tasks.pending', {
      id: activeTask.id,
      intent: activeTask.intent,
      projectId: activeTask.projectId || null,
      reason: 'death',
      savedAt: new Date().toISOString()
    })
    memory.set('tasks.current', null)
    memory.pushEvent('task_interrupted_by_death', {
      id: activeTask.id,
      resource: activeTask.resource,
      amount: activeTask.amount
    })
  }

  try {
    await memory.save()
  } catch (error) {
    console.error('[Milo] Failed to save death memory:', error)
  }
})

bot.on('kicked', reason => console.error('[Milo] Kicked:', reason))
bot.on('error', error => console.error('[Milo] Error:', error))
