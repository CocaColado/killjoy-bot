import http from 'node:http';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import {
  ChannelType, Client, EmbedBuilder, GatewayIntentBits, PermissionFlagsBits
} from '../../node_modules/discord.js/src/index.js';
import { ROOT, DATA, CONFIG, audit, ensureData, loadConfig, readJson, writeJson } from './store.js';
import { createEvent, forceFinalizeClips, getAutomations, getClipState, getEvents, setupOverdrive, updateAutomations, updateClipState } from './overdrive.js';
import { joinChannel, leaveVoice, playFile, stopAudio, voiceState } from './voice.js';

const execFileAsync = promisify(execFile);
const publicDir = path.join(ROOT, 'public');
const plansFile = path.join(DATA, 'plans.json');
const backupsDir = path.join(DATA, 'backups');
let config = await loadConfig();
let client = null;
let connecting = false;
let startedAt = null;
let lastError = '';

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};
const body = async req => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};
const safe = fn => async (req, res) => {
  try { await fn(req, res); } catch (error) {
    lastError = error?.message || String(error);
    console.error(error);
    json(res, 500, { ok: false, error: lastError });
  }
};

async function protectToken(token) {
  const script = `$s=ConvertTo-SecureString $env:KJ_TOKEN -AsPlainText -Force; ConvertFrom-SecureString $s`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { env: { ...process.env, KJ_TOKEN: token }, windowsHide: true });
  return stdout.trim();
}
async function revealToken() {
  if (!config.tokenProtected) return '';
  const script = `$s=ConvertTo-SecureString $env:KJ_SECRET; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { env: { ...process.env, KJ_SECRET: config.tokenProtected }, windowsHide: true });
  return stdout.trim();
}
function guild() {
  const found = client?.guilds.cache.get(config.guildId);
  if (!found) throw new Error('O OVERDRIVE ainda não está conectado ao servidor configurado.');
  return found;
}
async function connectBot() {
  if (client?.isReady() || connecting) return;
  const token = await revealToken();
  if (!token) return;
  connecting = true;
  client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates] });
  client.on('error', e => { lastError = e.message; });
  client.once('ready', async () => {
    connecting = false; startedAt = Date.now(); lastError = '';
    await audit('system.online', `${client.user.tag} conectado ao Discord`);
    await setupOverdrive(client);
    console.log(`Killjoy Control: ${client.user.tag} online.`);
  });
  try { await client.login(token); } catch (e) { connecting = false; lastError = e.message; client = null; throw e; }
}
async function disconnectBot() {
  if (client) { await client.destroy(); client = null; }
  startedAt = null;
  await audit('system.offline', 'OVERDRIVE desconectado pelo painel');
}

function snapshot(g) {
  return {
    version: 1, guild: { id: g.id, name: g.name, icon: g.iconURL() }, createdAt: new Date().toISOString(),
    channels: [...g.channels.cache.values()].sort((a,b) => a.rawPosition-b.rawPosition).map(c => ({ id:c.id, name:c.name, type:c.type, parentId:c.parentId, position:c.rawPosition, topic:c.topic ?? null, nsfw:c.nsfw ?? false, rateLimitPerUser:c.rateLimitPerUser ?? 0, permissionOverwrites:[...c.permissionOverwrites.cache.values()].map(p=>({id:p.id,type:p.type,allow:p.allow.bitfield.toString(),deny:p.deny.bitfield.toString()})) })),
    roles: [...g.roles.cache.values()].sort((a,b)=>b.position-a.position).map(r => ({ id:r.id,name:r.name,color:r.hexColor,position:r.position,hoist:r.hoist,mentionable:r.mentionable,permissions:r.permissions.bitfield.toString(),managed:r.managed })),
    settings: { verificationLevel:g.verificationLevel, explicitContentFilter:g.explicitContentFilter, defaultMessageNotifications:g.defaultMessageNotifications, afkTimeout:g.afkTimeout, afkChannelId:g.afkChannelId, systemChannelId:g.systemChannelId, rulesChannelId:g.rulesChannelId }
  };
}
async function createBackup() {
  const g = guild();
  await ensureData();
  const snap = snapshot(g);
  const name = `${new Date().toISOString().replace(/[:.]/g,'-')}-${g.id}.json`;
  await import('node:fs/promises').then(fs => fs.mkdir(backupsDir,{recursive:true}));
  await writeJson(path.join(backupsDir, name), snap);
  await audit('backup.created', `Backup ${name}`);
  return { name, snapshot: snap };
}
async function makePlan(kind, payload, summary, dangerous = false) {
  const plans = await readJson(plansFile, []);
  const plan = { id: crypto.randomUUID(), kind, payload, summary, dangerous, createdAt:new Date().toISOString(), status:'pending' };
  plans.unshift(plan); await writeJson(plansFile, plans.slice(0,100)); return plan;
}
async function executePlan(id) {
  const plans = await readJson(plansFile, []);
  const plan = plans.find(p=>p.id===id);
  if (!plan || plan.status !== 'pending') throw new Error('Plano inexistente ou já executado.');
  const g = guild(); let result;
  if (plan.kind === 'channel.create') {
    result = await g.channels.create({ name:plan.payload.name, type:Number(plan.payload.type), parent:plan.payload.parentId||null, topic:plan.payload.topic||undefined, reason:'Killjoy Control' });
  } else if (plan.kind === 'channel.edit') {
    const target = await g.channels.fetch(plan.payload.id); if (!target) throw new Error('Canal não encontrado.');
    plan.before = { name:target.name, topic:target.topic, parentId:target.parentId };
    result = await target.edit({ name:plan.payload.name||target.name, topic:plan.payload.topic ?? target.topic, parent:plan.payload.parentId ?? target.parentId, reason:'Killjoy Control' });
  } else if (plan.kind === 'channel.delete') {
    const target = await g.channels.fetch(plan.payload.id); if (!target) throw new Error('Canal não encontrado.');
    plan.before = { name:target.name, type:target.type, topic:target.topic, parentId:target.parentId };
    await target.delete('Killjoy Control'); result = { id:plan.payload.id };
  } else if (plan.kind === 'role.create') {
    result = await g.roles.create({ name:plan.payload.name, color:plan.payload.color||'#FFD84D', hoist:!!plan.payload.hoist, mentionable:!!plan.payload.mentionable, reason:'Killjoy Control' });
  } else if (plan.kind === 'role.edit') {
    const target = await g.roles.fetch(plan.payload.id); if (!target) throw new Error('Cargo não encontrado.');
    plan.before = { name:target.name,color:target.hexColor,hoist:target.hoist,mentionable:target.mentionable };
    result = await target.edit({ name:plan.payload.name||target.name,color:plan.payload.color||target.hexColor,hoist:plan.payload.hoist??target.hoist,mentionable:plan.payload.mentionable??target.mentionable,reason:'Killjoy Control' });
  } else if (plan.kind === 'role.delete') {
    const target = await g.roles.fetch(plan.payload.id); if (!target) throw new Error('Cargo não encontrado.');
    plan.before = { name:target.name,color:target.hexColor,hoist:target.hoist,mentionable:target.mentionable };
    await target.delete('Killjoy Control'); result={id:plan.payload.id};
  } else if (plan.kind === 'message.send') {
    const channel = await g.channels.fetch(plan.payload.channelId); if (!channel?.isTextBased()) throw new Error('Escolha um canal de texto.');
    const embed = new EmbedBuilder().setColor(plan.payload.color||0xffd84d).setTitle(plan.payload.title).setDescription(plan.payload.description).setFooter({text:'Killjoy // OVERDRIVE'}).setTimestamp();
    result = await channel.send({ content:plan.payload.content||undefined, embeds:[embed] });
  } else if (plan.kind === 'member.role') {
    const member = await g.members.fetch(plan.payload.memberId); const role = await g.roles.fetch(plan.payload.roleId);
    if (!role) throw new Error('Cargo não encontrado.');
    plan.payload.action === 'remove' ? await member.roles.remove(role,'Killjoy Control') : await member.roles.add(role,'Killjoy Control'); result=member;
  } else throw new Error('Tipo de plano ainda não implementado.');
  plan.status='executed'; plan.executedAt=new Date().toISOString(); plan.resultId=result?.id;
  await writeJson(plansFile, plans); await audit(plan.kind, plan.summary); return plan;
}

const routes = new Map();
const route = (method, pathname, handler) => routes.set(`${method} ${pathname}`, safe(handler));
route('GET','/api/state',async(req,res)=>json(res,200,{ok:true,configured:!!config.tokenProtected,connected:!!client?.isReady(),connecting,user:client?.user?{id:client.user.id,tag:client.user.tag,avatar:client.user.displayAvatarURL()}:null,guild:client?.isReady()?{id:guild().id,name:guild().name,icon:guild().iconURL(),members:guild().memberCount}:null,uptime:startedAt?Date.now()-startedAt:0,lastError,port:config.port||17860}));
route('POST','/api/setup',async(req,res)=>{const data=await body(req);if(!data.token||!data.guildId)throw new Error('Informe o token do segundo bot e o ID do servidor.');config={...config,guildId:String(data.guildId),ownerIds:data.ownerIds||[],port:config.port||17860,tokenProtected:await protectToken(data.token)};await writeJson(CONFIG,config);await audit('config.saved','Configuração protegida salva no Windows');await connectBot();json(res,200,{ok:true});});
route('POST','/api/connect',async(req,res)=>{await connectBot();json(res,200,{ok:true});});
route('POST','/api/disconnect',async(req,res)=>{await disconnectBot();json(res,200,{ok:true});});
route('GET', '/api/server', async (req, res) => {
  const g = guild();
  await g.channels.fetch();
  await g.roles.fetch();
  const channels = [...g.channels.cache.values()]
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map(c => ({
      id: c.id, name: c.name, type: c.type, parentId: c.parentId,
      position: c.rawPosition, topic: c.topic || '', members: c.members?.size || 0
    }));
  const roles = [...g.roles.cache.values()]
    .sort((a, b) => b.position - a.position)
    .map(r => ({
      id: r.id, name: r.name, color: r.hexColor, position: r.position,
      members: r.members.size, managed: r.managed, editable: r.editable
    }));
  json(res, 200, {
    ok: true, channels, roles,
    permissions: client.user ? g.members.me.permissions.toArray() : []
  });
});
route('GET','/api/members',async(req,res)=>{const g=guild();const members=await g.members.fetch({limit:1000});json(res,200,{ok:true,members:[...members.values()].filter(m=>!m.user.bot).map(m=>({id:m.id,name:m.displayName,username:m.user.username,avatar:m.displayAvatarURL(),roles:m.roles.cache.filter(r=>r.id!==g.id).map(r=>r.id),joinedAt:m.joinedTimestamp}))});});
route('GET','/api/audit',async(req,res)=>json(res,200,{ok:true,items:await readJson(path.join(DATA,'audit.json'),[])}));
route('GET','/api/plans',async(req,res)=>json(res,200,{ok:true,items:await readJson(plansFile,[])}));
route('POST','/api/plan',async(req,res)=>{const data=await body(req);const summaries={ 'channel.create':`Criar canal #${data.payload?.name}`,'channel.edit':`Editar canal ${data.payload?.id}`,'channel.delete':`Excluir canal ${data.payload?.id}`,'role.create':`Criar cargo ${data.payload?.name}`,'role.edit':`Editar cargo ${data.payload?.id}`,'role.delete':`Excluir cargo ${data.payload?.id}`,'message.send':`Publicar anúncio em ${data.payload?.channelId}`,'member.role':`${data.payload?.action==='remove'?'Remover':'Adicionar'} cargo de membro`};const plan=await makePlan(data.kind,data.payload,summaries[data.kind]||data.kind,['channel.delete','role.delete'].includes(data.kind));json(res,200,{ok:true,plan});});
route('POST','/api/execute',async(req,res)=>{const data=await body(req);json(res,200,{ok:true,plan:await executePlan(data.id)});});
route('POST','/api/backup',async(req,res)=>{const backup=await createBackup();json(res,200,{ok:true,name:backup.name});});
route('GET','/api/clips',async(req,res)=>json(res,200,{ok:true,data:await getClipState()}));
route('POST','/api/clips/settings',async(req,res)=>{const data=await body(req);json(res,200,{ok:true,data:await updateClipState({channelId:data.channelId||'',endsAt:data.endsAt||undefined})});});
route('POST','/api/clips/finalize',async(req,res)=>json(res,200,{ok:true,winner:await forceFinalizeClips(client)}));
route('GET','/api/automations',async(req,res)=>json(res,200,{ok:true,data:await getAutomations()}));
route('POST','/api/automations',async(req,res)=>{const data=await body(req);json(res,200,{ok:true,data:await updateAutomations(data)});});
route('GET','/api/events',async(req,res)=>json(res,200,{ok:true,items:await getEvents()}));
route('POST','/api/events',async(req,res)=>{const data=await body(req);json(res,200,{ok:true,event:await createEvent(client,data)});});
route('GET','/api/voice',async(req,res)=>json(res,200,{ok:true,data:voiceState()}));
route('POST','/api/voice/join',async(req,res)=>{const data=await body(req);json(res,200,{ok:true,data:await joinChannel(client,data.channelId)});});
route('POST','/api/voice/play',async(req,res)=>{const data=await body(req);json(res,200,{ok:true,data:await playFile(data.file,data.volume)});});
route('POST','/api/voice/stop',async(req,res)=>json(res,200,{ok:true,data:stopAudio()}));
route('POST','/api/voice/leave',async(req,res)=>json(res,200,{ok:true,data:await leaveVoice()}));
route('POST','/api/shutdown',async(req,res)=>{
  json(res,200,{ok:true});
  setTimeout(async()=>{ try { await disconnectBot(); } finally { process.exit(0); } },250).unref();
});

async function serve(req,res) {
  const url = new URL(req.url,'http://127.0.0.1');
  const handler=routes.get(`${req.method} ${url.pathname}`); if(handler)return handler(req,res);
  const requested=url.pathname==='/'?'index.html':url.pathname.slice(1); const file=path.normalize(path.join(publicDir,requested));
  if(!file.startsWith(publicDir)||!existsSync(file)){res.writeHead(404);return res.end('Not found');}
  const ext=path.extname(file);const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
  res.writeHead(200,{'content-type':types[ext]||'application/octet-stream'});res.end(await readFile(file));
}
await ensureData();
const port=config.port||17860;
http.createServer((req,res)=>serve(req,res).catch(e=>json(res,500,{ok:false,error:e.message}))).listen(port,'127.0.0.1',async()=>{
  console.log(`Killjoy Control aberto em http://127.0.0.1:${port}`);
  try{await connectBot();}catch(e){console.error('OVERDRIVE aguardando configuração:',e.message);}
});
