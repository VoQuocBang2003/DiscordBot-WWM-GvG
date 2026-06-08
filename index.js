// ================= IMPORT =================
const {
  Client, GatewayIntentBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  SlashCommandBuilder, Routes, REST, EmbedBuilder,
  PermissionsBitField, StringSelectMenuBuilder
  , ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');

// load environment variables from .env when present
require('dotenv').config();

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const MATCH_CHANNEL_ID = process.env.MATCH_CHANNEL_ID;

if (!TOKEN) {
  console.error('Missing TOKEN environment variable. Set TOKEN in .env or environment.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ================= DATA =================
const fs = require('fs');
const path = require('path');

let profiles = {};
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

function loadProfiles() {
  try {
    ensureDataDir();
    if (fs.existsSync(PROFILES_FILE)) {
      const raw = fs.readFileSync(PROFILES_FILE, 'utf8');
      profiles = JSON.parse(raw || '{}');
      console.log(`Loaded ${Object.keys(profiles).length} profiles`);
    }
  } catch (e) {
    console.error('Failed to load profiles:', e.message);
    profiles = {};
  }
}

function saveProfiles() {
  try {
    ensureDataDir();
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save profiles:', e.message);
  }
}

// load persisted profiles on startup
loadProfiles();
let matches = {};
let selectedMatch = {};
let selectedUser = {};

// ================= COMMAND =================
const commands = [

  // ===== PROFILE =====
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Cập nhật profile')
    .addStringOption(o => o.setName('ten').setDescription('Tên').setRequired(true))
    .addStringOption(o =>
      o.setName('vu_khi')
        .setDescription('Vũ khí')
        .setRequired(true)
        .addChoices(
          { name: '🔵 Vô danh', value: 'Vô danh' },
          { name: '🔵 Cửu kiếm', value: 'Cửu kiếm' },
          { name: '🟢 Quạt dù công', value: 'Quạt dù công' },
          { name: '🟢 Quạt dù heal', value: 'Quạt dù heal' },
          { name: '🟣 Quạt dù ném', value: 'Quạt dù ném' },
          { name: '🟣 Quyền', value: 'Quyền' },
          { name: '🟤 Đại đao', value: 'Đại đao' },
          { name: '🟤 Hoành đao', value: 'Hoành đao' },
          { name: '🟣 Song đao', value: 'Song đao' }
        )
    ),

  // ===== OPEN MATCH =====
  new SlashCommandBuilder()
    .setName('open-match')
    .setDescription('Tạo đăng ký bang chiến')
    .addStringOption(o => o.setName('id').setDescription('ID trận').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('Tiêu đề').setRequired(true)),

  // ===== CLOSE =====
  new SlashCommandBuilder()
    .setName('close-match')
    .setDescription('Đóng đăng ký bang chiến')
    .addStringOption(o => o.setName('id').setDescription('ID trận').setRequired(true)),

  // ===== REFRESH =====
  new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Refresh bảng')
    .addStringOption(o => o.setName('id').setDescription('ID trận').setRequired(true)),

  // ===== ADD ADMIN =====
   new SlashCommandBuilder()
  .setName('add')
  .setDescription('Thêm người vào danh sách')
  .addStringOption(o => o.setName('id').setDescription('ID trận').setRequired(true))
  .addStringOption(o => o.setName('ten').setDescription('Tên').setRequired(true))
  .addStringOption(o =>
    o.setName('vu_khi')
      .setDescription('Vũ khí')
      .setRequired(true)
      .addChoices(
        { name: '🔵 Vô danh', value: 'Vô danh' },
        { name: '🔵 Cửu kiếm', value: 'Cửu kiếm' },
        { name: '🟢 Quạt dù công', value: 'Quạt dù công' },
        { name: '🟢 Quạt dù heal', value: 'Quạt dù heal' },
        { name: '🟣 Quạt dù ném', value: 'Quạt dù ném' },
        { name: '🟣 Quyền', value: 'Quyền' },
        { name: '🟤 Đại đao', value: 'Đại đao' },
        { name: '🟤 Hoành đao', value: 'Hoành đao' },
        { name: '🟣 Song đao', value: 'Song đao' }
      )
  )
  .addStringOption(o =>
    o.setName('team')
      .setDescription('Team')
      .setRequired(true)
        .addChoices(
          { name: 'Công', value: 'attack' },
          { name: 'Thủ', value: 'defend' },
          { name: 'Công 1', value: 'attack1' },
          { name: 'Công 2', value: 'attack2' },
          { name: 'Công 3', value: 'attack3' },
          { name: 'Thủ 1', value: 'defend1' },
          { name: 'Thủ 2', value: 'defend2' },
          { name: 'Thủ 3', value: 'defend3' }
        )
    ),

  // ===== MANAGE =====
  new SlashCommandBuilder()
    .setName('manage')
    .setDescription('Quản lý trận')
];

// ================= REGISTER =================
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
})();

// ================= HELPER =================
function getButtons(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`attack_${id}`).setLabel('Team Công').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`defend_${id}`).setLabel('Team Thủ').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cancel_${id}`).setLabel('Hủy').setStyle(ButtonStyle.Secondary)
  );
}

function getAdminButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_attack1').setLabel('Công 1').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('admin_attack2').setLabel('Công 2').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('admin_attack3').setLabel('Công 3').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('admin_defend1').setLabel('Thủ 1').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_defend2').setLabel('Thủ 2').setStyle(ButtonStyle.Primary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_defend3').setLabel('Thủ 3').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_remove').setLabel('Xóa').setStyle(ButtonStyle.Secondary)
  );
  return [row1, row2];
}

function render(m, id) {
  const attackCounts = m.attack.reduce((acc, p) => {
    const r = classifyRole(p.weapon);
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, { Heal: 0, Tank: 0, DPS: 0 });

  const defendCounts = m.defend.reduce((acc, p) => {
    const r = classifyRole(p.weapon);
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, { Heal: 0, Tank: 0, DPS: 0 });

  const attackStats = `DPS: ${attackCounts.DPS} | Heal: ${attackCounts.Heal} | Tank: ${attackCounts.Tank}`;
  const defendStats = `DPS: ${defendCounts.DPS} | Heal: ${defendCounts.Heal} | Tank: ${defendCounts.Tank}`;

  const slotDisplay = (slot) => (m.slots && m.slots[slot] && m.slots[slot].length)
    ? m.slots[slot].map(p => `${getDisplayName(p)} ${getWeaponEmoji(p.weapon)} ${p.weapon || ''}`).join('\n')
    : '---';

  const teamDisplay = (arr) => (arr && arr.length)
    ? arr.map(p => `${getDisplayName(p)} ${getWeaponEmoji(p.weapon)} ${p.weapon || ''}`).join('\n')
    : '---';

  const header = `**${m.title} [${id}]**`;
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setDescription(header);

  embed.addFields(
    { name: `Team Công (${(m.attack||[]).length}/15)`, value: teamDisplay(m.attack), inline: true },
    { name: `Team Thủ (${(m.defend||[]).length}/15)`, value: teamDisplay(m.defend), inline: true },
    { name: `Dự bị (${(m.reserve||[]).length})`, value: teamDisplay(m.reserve), inline: true },
    { name: 'Công Stats', value: attackStats, inline: true },
    { name: 'Thủ Stats', value: defendStats, inline: true },
    { name: '\u200b', value: '\u200b', inline: true },
    { name: 'Công 1', value: slotDisplay('attack1'), inline: true },
    { name: 'Công 2', value: slotDisplay('attack2'), inline: true },
    { name: 'Công 3', value: slotDisplay('attack3'), inline: true },
    { name: 'Thủ 1', value: slotDisplay('defend1'), inline: true },
    { name: 'Thủ 2', value: slotDisplay('defend2'), inline: true },
    { name: 'Thủ 3', value: slotDisplay('defend3'), inline: true }
  );

  return embed;
}

function getWeaponEmoji(weapon) {
  if (!weapon) return '';
  const w = weapon.toString();
  if (w === 'Vô danh' || w === 'Cửu kiếm') return '🔵';
  if (w === 'Quạt dù công' || w === 'Quạt dù heal') return '🟢';
  if (w === 'Quạt dù ném' || w === 'Song đao' || w === 'Quyền') return '🟣';
  if (w === 'Đại đao' || w === 'Hoành đao') return '🟤';
  return '';
}

function weaponShort(weapon) {
  if (!weapon) return 'VD';
  const w = weapon.toString();
  const map = {
    'Vô danh': 'VD',
    'Cửu kiếm': 'CK',
    'Quạt dù công': 'QDC',
    'Quạt dù heal': 'QDH',
    'Quạt dù ném': 'QDN',
    'Đại đao': 'DD',
    'Hoành đao': 'HD',
    'Song đao': 'SD',
    'Quyền': 'Q'
  };
  return map[w] || w.slice(0,3).toUpperCase();
}

function classifyRole(weapon) {
  if (!weapon) return 'DPS';
  const w = weapon.toString();
  if (w === 'Quạt dù heal') return 'Heal';
  if (w === 'Đại đao') return 'Tank';
  return 'DPS';
}

function getDisplayName(p) {
  if (!p) return '';
  const name = (typeof p === 'string') ? p : (p.name || '');
  const m = name.match(/^seed_\d+_(.+)$/);
  if (m) return m[1];
  return name;
}

function log(msg) {
  const ch = client.channels.cache.get(LOG_CHANNEL_ID);
  if (ch) ch.send(msg);
}

function logProfile(userId, name, weapon, prefix = '') {
  const ch = client.channels.cache.get(LOG_CHANNEL_ID);
  const displayName = name || 'Vô danh';
  const displayWeapon = weapon || 'Vô danh';
  const mention = userId ? `<@${userId}>` : '';
  const msg = `${prefix ? prefix + ' ' : ''}${mention} | ${displayName} | ${displayWeapon}`;
  if (ch) ch.send(msg);
}

function autoFill(m) {
  // Promote from reserve into teams up to 15 slots
  if (!m || !m.reserve) return;
  const promote = (team) => {
    const target = team === 'attack' ? m.attack : m.defend;
    let i = m.reserve.findIndex(p => p.team === team);
    while (i !== -1 && target.length < 15) {
      const player = m.reserve.splice(i, 1)[0];
      target.push({ id: player.id, name: player.name, weapon: player.weapon, team });
      i = m.reserve.findIndex(p => p.team === team);
    }
  };

  promote('attack');
  promote('defend');
}

function getMatchOptions() {
  return Object.entries(matches).map(([id, m]) => ({
    label: m.title,
    description: id,
    value: id
  }));
}

// ================= READY =================
client.once('clientReady', () => {
  console.log(`Bot online: ${client.user.tag}`);
});

// ================= INTERACTION =================
client.on('interactionCreate', async i => {

  const isAdmin = i.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

  // ===== COMMAND =====
  if (i.isChatInputCommand()) {

    if (i.commandName === 'profile') {
      profiles[i.user.id] = {
        name: i.options.getString('ten'),
        weapon: i.options.getString('vu_khi')
      };
      logProfile(i.user.id, profiles[i.user.id].name, profiles[i.user.id].weapon, '🟢 Báo danh thành công:');
      // persist profile to disk
      try { saveProfiles(); } catch (e) { /* already logged in saveProfiles */ }
      return i.reply({ content: '✅ Lưu profile', ephemeral: true });
    }

    if (i.commandName === 'open-match') {
      if (!isAdmin) return;

      const id = i.options.getString('id');

      matches[id] = {
        title: i.options.getString('title'),
        attack: [],
        defend: [],
        reserve: [],
        open: true,
        messageId: null,
        slots: {
          attack1: [], attack2: [], attack3: [],
          defend1: [], defend2: [], defend3: []
        }
      };

      

      const ch = client.channels.cache.get(MATCH_CHANNEL_ID);
      const msg = await ch.send({
        embeds: [render(matches[id], id)],
        components: [getButtons(id)]
      });

      matches[id].messageId = msg.id;

      return i.reply({ content: `✅ Đã mở đăng ký bang chiến ${id}`, ephemeral: true });
    }

    if (i.commandName === 'close-match') {
      if (!isAdmin) return;

      const id = i.options.getString('id');
      if (matches[id]) matches[id].open = false;

      return i.reply({ content: `⛔ Đã đóng đăng ký bang chiến ${id}`, ephemeral: true });
    }

    if (i.commandName === 'refresh') {
      if (!isAdmin) return;

      const id = i.options.getString('id');
      const m = matches[id];
      if (!m) return;

      const ch = client.channels.cache.get(MATCH_CHANNEL_ID);
      const msg = await ch.messages.fetch(m.messageId);

      // Re-render current match state and auto-fill reserves
      autoFill(m);

      await msg.edit({
        embeds: [render(m, id)],
        components: [getButtons(id)]
      });

      return i.reply({ content: `🔄 Đã refresh danh sách ${id}`, ephemeral: true });
    }

    if (i.commandName === 'add') {
      if (!isAdmin) return;

      const id = i.options.getString('id');
      const m = matches[id];

      const player = {
        id: 'admin_' + Date.now(),
        name: i.options.getString('ten'),
        weapon: i.options.getString('vu_khi'),
        team: i.options.getString('team')
      };

      const teamOpt = player.team;
      // Ensure removed from anywhere first
      m.attack = m.attack.filter(p => p.id !== player.id);
      m.defend = m.defend.filter(p => p.id !== player.id);
      m.reserve = m.reserve.filter(p => p.id !== player.id);
      Object.keys(m.slots).forEach(s => {
        m.slots[s] = m.slots[s].filter(p => p.id !== player.id);
      });

      // If specific slot selected, assign there and to main team
      if (teamOpt && teamOpt.startsWith('attack')) {
        m.attack.push({ id: player.id, name: player.name, weapon: player.weapon, team: 'attack' });
        if (m.slots && m.slots[teamOpt]) m.slots[teamOpt].push({ id: player.id, name: player.name, weapon: player.weapon });
      } else if (teamOpt && teamOpt.startsWith('defend')) {
        m.defend.push({ id: player.id, name: player.name, weapon: player.weapon, team: 'defend' });
        if (m.slots && m.slots[teamOpt]) m.slots[teamOpt].push({ id: player.id, name: player.name, weapon: player.weapon });
      } else if (teamOpt === 'attack') {
        m.attack.push({ id: player.id, name: player.name, weapon: player.weapon, team: 'attack' });
      } else {
        m.defend.push({ id: player.id, name: player.name, weapon: player.weapon, team: 'defend' });
      }

      autoFill(m);

      return i.reply({ content: `✅ Đã thêm người chơi vào ${id}`, ephemeral: true });
    }

    // ===== MANAGE STEP 1 =====
    if (i.commandName === 'manage') {
      if (!isAdmin) return;

      const options = getMatchOptions();
      if (!options || options.length === 0) {
        return i.reply({ content: '❌ Hiện không có trận nào để quản lý', ephemeral: true });
      }

      // Discord allows 1-25 options per select menu — limit if necessary
      const safeOptions = options.slice(0, 50);

      const select = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_match')
          .setPlaceholder('Chọn trận')
          .addOptions(safeOptions)
      );

      return i.reply({ content: 'Chọn trận', components: [select], ephemeral: true });
    }
  }

  // ===== SELECT MATCH =====
  if (i.isStringSelectMenu()) {

    if (i.customId === 'select_match') {
      const matchId = i.values[0];
      selectedMatch[i.user.id] = matchId;

      const m = matches[matchId];
      const players = [...m.attack, ...m.defend, ...m.reserve];

      if (!players || players.length === 0) {
        return i.update({ content: `Match: ${matchId} — Không có người`, components: getAdminButtons() });
      }

      // Build initial player select showing non-Latin names first
      const nonLatin = players.filter(p => !/^[A-Za-z]/.test(p.name));
      const nonLatinOpts = nonLatin.slice(0, 24).map(p => ({ label: `${getWeaponEmoji(p.weapon)} ${getDisplayName(p)}`, value: p.id }));
      // Build A-Z select for Latin initial filtering
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      const letterOpts = letters.map(l => ({ label: l, value: l }));
      const playerSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(`select_player:${matchId}`).setPlaceholder('Chọn người (CJK names shown)').addOptions(nonLatinOpts.length ? nonLatinOpts : [{ label: '---', value: 'none' }])
      );
      const initialSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(`select_initial:${matchId}`).setPlaceholder('Lọc theo chữ cái (A–Z)').addOptions(letterOpts.slice(0, 25))
      );
      return i.update({ content: `Match: ${matchId}`, components: [playerSelect, initialSelect, ...getAdminButtons()] });
    }

    if (i.customId && i.customId.startsWith('select_player:')) {
      const val = i.values[0];
      if (val === 'none') return i.reply({ content: 'No players to select', ephemeral: true });
      const matchIdFromCustom = i.customId.split(':')[1];
      const m = matches[matchIdFromCustom] || matches[selectedMatch[i.user.id]];
      let displayName = val;
      if (m) {
        const p = [...m.attack, ...m.defend, ...m.reserve].find(x => x.id === val) || Object.values(m.slots).flat().find(x => x.id === val);
        if (p && p.name) displayName = p.name;
      }
      selectedUser[i.user.id] = { id: val, name: displayName };
      return i.reply({ content: `✔ Chọn người: ${displayName}`, ephemeral: true });
    }

    if (i.customId && i.customId.startsWith('select_initial:')) {
      const matchId = i.customId.split(':')[1];
      const letter = i.values[0];
      const m2 = matches[matchId];
      if (!m2) return i.reply({ content: 'Match not found', ephemeral: true });
      const players2 = [...m2.attack, ...m2.defend, ...m2.reserve];
      const list = players2.filter(p => /^[A-Za-z]/.test(p.name) && p.name[0].toUpperCase() === letter);
      if (!list || list.length === 0) return i.reply({ content: `No players starting with ${letter}`, ephemeral: true });
      const opts = list.slice(0,25).map(p => ({ label: `${getWeaponEmoji(p.weapon)} ${getDisplayName(p)}`, value: p.id }));
      const playerSelect2 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(`select_player:${matchId}`).setPlaceholder(`Players starting with ${letter}`).addOptions(opts)
      );
      return i.update({ content: `Match: ${matchId} — Filter ${letter}`, components: [playerSelect2, ...getAdminButtons()] });
    }
  }

  // Modal submit handler for filter
  if (i.isModalSubmit()) {
    if (i.customId && i.customId.startsWith('filter_initial:')) {
      const matchId = i.customId.split(':')[1];
      const initial = (i.fields.getTextInputValue('initial') || '').trim().slice(0,1).toUpperCase();
      const m = matches[matchId];
      if (!m) return i.reply({ content: 'Match not found', ephemeral: true });
      const players = [...m.attack, ...m.defend, ...m.reserve];
      const list = players.filter(p => /^[A-Za-z]/.test(p.name) && p.name[0].toUpperCase() === initial);
      if (!list || list.length === 0) return i.reply({ content: `No players starting with ${initial}`, ephemeral: true });
      const opts = list.slice(0,25).map(p => ({ label: `${getWeaponEmoji(p.weapon)} ${getDisplayName(p)}`, value: p.id }));
      const sel = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('select_player_filtered').setPlaceholder(`Players starting with ${initial}`).addOptions(opts)
      );
      return i.reply({ content: `Filtered by ${initial}`, components: [sel, ...getAdminButtons()], ephemeral: true });
    }
    if (i.customId && i.customId.startsWith('manage_select_modal:')) {
      const matchId = i.customId.split(':')[1];
      const q = (i.fields.getTextInputValue('q') || '').trim();
      const m = matches[matchId];
      if (!m) return i.reply({ content: 'Match not found', ephemeral: true });
      const players = [...m.attack, ...m.defend, ...m.reserve];
      let list = [];
      if (!q) {
        // default: non-Latin names first
        list = players.filter(p => !/^[A-Za-z]/.test(p.name));
      } else {
        const initial = q[0].toUpperCase();
        list = players.filter(p => /^[A-Za-z]/.test(p.name) && p.name[0].toUpperCase() === initial);
      }
      if (!list || list.length === 0) return i.reply({ content: 'No matching players', ephemeral: true });
      const opts = list.slice(0,25).map(p => ({ label: `${getWeaponEmoji(p.weapon)} ${getDisplayName(p)}`, value: p.id }));
      const sel = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('select_player').setPlaceholder('Chọn người').addOptions(opts)
      );
      return i.reply({ content: 'Chọn người', components: [sel, ...getAdminButtons()], ephemeral: true });
    }
  }

  // ===== BUTTON =====
  if (i.isButton()) {

    const userId = i.user.id;

    // ===== ADMIN BUTTON =====
    if (i.customId.startsWith('admin_')) {
      const matchId = selectedMatch[userId];
      const sel = selectedUser[userId];
      const targetId = sel ? sel.id : null;
      const selectedName = sel ? sel.name : null;
      const m = matches[matchId];

      if (!m || !targetId) return i.reply({ content: '❌ thiếu dữ liệu', ephemeral: true });

      const resolvePlayer = (id) => {
        const p = profiles[id] ||
          [...m.attack, ...m.defend, ...m.reserve].find(x => x.id === id) ||
          Object.values(m.slots).flat().find(x => x.id === id) ||
          { id, name: id, weapon: 'Vô danh' };
        return p;
      };

      // capture existing profile/slot info before removing from lists
      const prof = resolvePlayer(targetId);

      const slotAction = i.customId.replace('admin_', '');

      // Immediate apply: remove or assign
      if (slotAction === 'remove') {
        m.attack = m.attack.filter(p => p.id !== targetId);
        m.defend = m.defend.filter(p => p.id !== targetId);
        m.reserve = m.reserve.filter(p => p.id !== targetId);
        Object.keys(m.slots).forEach(s => { m.slots[s] = m.slots[s].filter(p => p.id !== targetId); });

        // update message
        const ch = client.channels.cache.get(MATCH_CHANNEL_ID);
        const msg = await ch.messages.fetch(m.messageId);
        await msg.edit({ embeds: [render(m, matchId)], components: [getButtons(matchId)] });

        // log admin removal using captured profile info; if entry was admin-added, don't mention ID
        try {
          if (String(targetId).startsWith('admin_')) {
            logProfile(null, prof.name, prof.weapon, '❌ Admin xóa khỏi trận:');
          } else {
            logProfile(targetId, prof.name, prof.weapon, '❌ Admin xóa khỏi trận:');
          }
        } catch (e) { /* ignore logging errors */ }

        return i.reply({ content: `✅ Đã xóa ${selectedName || getDisplayName(prof)} khỏi trận`, ephemeral: true });
      }

      // assign to specific slot immediately: remove from any existing lists first
      Object.keys(m.slots).forEach(s => { m.slots[s] = m.slots[s].filter(p => p.id !== targetId); });
      m.attack = m.attack.filter(p => p.id !== targetId);
      m.defend = m.defend.filter(p => p.id !== targetId);
      m.reserve = m.reserve.filter(p => p.id !== targetId);
      if (!m.slots[slotAction]) m.slots[slotAction] = [];
      const displayNameToUse = selectedName || prof.name || targetId;
      if (!m.slots[slotAction].some(x => x.id === targetId)) m.slots[slotAction].push({ id: targetId, name: displayNameToUse, weapon: prof.weapon });

      if (slotAction.startsWith('attack')) {
        if (!m.attack.some(x => x.id === targetId)) m.attack.push({ id: targetId, name: displayNameToUse, weapon: prof.weapon, team: 'attack' });
      } else {
        if (!m.defend.some(x => x.id === targetId)) m.defend.push({ id: targetId, name: displayNameToUse, weapon: prof.weapon, team: 'defend' });
      }

      autoFill(m);
      const ch = client.channels.cache.get(MATCH_CHANNEL_ID);
      const msg = await ch.messages.fetch(m.messageId);
      await msg.edit({ embeds: [render(m, matchId)], components: [getButtons(matchId)] });

      return i.reply({ content: `✅ Đã gán ${selectedName || getDisplayName(prof)} vào ${slotAction}`, ephemeral: true });
    }

    // ===== USER BUTTON =====
    const [action, id] = i.customId.split('_');
    const m = matches[id];

    if (!m || !m.open)
      return i.reply({ content: '⛔ Đã đóng đăng ký', ephemeral: true });

    const profile = profiles[userId];
    if (!profile)
      return i.reply({ content: '⚠️ Bạn chưa báo danh profile -> đến kênh báo danh bang chiến', ephemeral: true });
 // Determine whether the user is currently registered in this match
    const inMain = (m.attack || []).some(p => p.id === userId) || (m.defend || []).some(p => p.id === userId) || (m.reserve || []).some(p => p.id === userId);
    const inSlots = Object.values(m.slots || {}).flat().some(p => p.id === userId);
    const wasRegistered = inMain || inSlots;

    // If user clicks cancel but is not registered (or admin already removed them), inform them instead of logging
    if (action === 'cancel' && !wasRegistered) {
      return i.reply({ content: '⚠️ Bạn chưa đăng ký', ephemeral: true });
    }

    m.attack = m.attack.filter(p => p.id !== userId);
    m.defend = m.defend.filter(p => p.id !== userId);
    m.reserve = m.reserve.filter(p => p.id !== userId);
    // also remove from slot-specific lists so cancel fully unregisters the player
    Object.keys(m.slots).forEach(s => { m.slots[s] = m.slots[s].filter(p => p.id !== userId); });

    let userPlacedToReserve = false;
    if (action === 'attack') {
      if ((m.attack || []).length < 15) {
        m.attack.push({ id: userId, ...profile, team: 'attack' });
      } else {
        // team full -> add to reserve with intended team
        m.reserve.push({ id: userId, ...profile, team: 'attack' });
        userPlacedToReserve = true;
      }
    }

    if (action === 'defend') {
      if ((m.defend || []).length < 15) {
        m.defend.push({ id: userId, ...profile, team: 'defend' });
      } else {
        m.reserve.push({ id: userId, ...profile, team: 'defend' });
        userPlacedToReserve = true;
      }
    }

    if (action === 'cancel') {
      logProfile(userId, profile.name, profile.weapon, `❌ Hủy đăng ký (${id}):`);
    }

    autoFill(m);

    const ch = client.channels.cache.get(MATCH_CHANNEL_ID);
    const msg = await ch.messages.fetch(m.messageId);

    await msg.edit({
      embeds: [render(m, id)],
      components: [getButtons(id)]
    });

    if (userPlacedToReserve) {
      return i.reply({ content: '🔔 Team đã đủ, bạn được xếp vào danh sách dự bị. Bạn sẽ tự động được chuyển khi có slot trống.', ephemeral: true });
    }

    return i.deferUpdate();
  }
});

// ================= LOGIN =================
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive");
});

app.listen(process.env.PORT || 3000);
// save profiles on process exit
process.on('SIGINT', () => { console.log('SIGINT received — saving profiles'); saveProfiles(); process.exit(0); });
process.on('SIGTERM', () => { console.log('SIGTERM received — saving profiles'); saveProfiles(); process.exit(0); });
process.on('exit', () => { saveProfiles(); });

client.login(TOKEN);
