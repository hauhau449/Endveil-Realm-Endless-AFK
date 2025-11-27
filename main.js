(function dialogPolyfill(){
  function attachBackdrop(dlg){
    if(dlg._bd) return;
    const bd=document.createElement('div');
    bd.className='modal-backdrop';
    bd.addEventListener('click', ()=> dlg.close());
    document.body.appendChild(bd);
    document.body.classList.add('has-modal');
    dlg._bd=bd;
  }
  function detachBackdrop(dlg){
    if(!dlg._bd) return;
    dlg._bd.remove(); dlg._bd=null;
    const anyOpen=[...document.querySelectorAll('dialog')].some(d=>d.hasAttribute('open'));
    if(!anyOpen) document.body.classList.remove('has-modal');
  }
  function ensure(){
    document.querySelectorAll('dialog').forEach(d=>{
      if(typeof d.showModal!=='function'){
        d.showModal=function(){ this.setAttribute('open',''); attachBackdrop(this); };
      }
      if(typeof d.close!=='function'){
        d.close=function(){ this.removeAttribute('open'); detachBackdrop(this); };
      }else{
        const _close=d.close.bind(d);
        d.close=function(){ try{ _close(); }catch(_){ this.removeAttribute('open'); } detachBackdrop(this); };
      }
    });
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', ensure);
  }else{
    ensure();
  }
  const mo=new MutationObserver(()=>ensure());
  mo.observe(document.documentElement,{subtree:true,childList:true});
})();

function toggleUpdateLog(){
  const body = document.querySelector('#updateLog .log-body');
  const toggle = document.getElementById('logToggle');
  if(!body || !toggle) return;
  const hidden = body.hasAttribute('hidden');
  if(hidden){
    body.removeAttribute('hidden');
    toggle.textContent = "(點擊收合)";
  }else{
    body.setAttribute('hidden','');
    toggle.textContent = "(點擊展開)";
  }
}

(function(){
  const $=s=>document.querySelector(s), LKEY="stealth_rpg_full_v4";
  const log=$("#log"), statsBox=$("#stats"), invBox=$("#inv");
  let skillDlg;
  let classNoticeDlg, classNoticeText;
  let currentSkillTierTab=0;
  const enemyUI={name:$("#eName"),lvl:$("#eLvl"),atk:$("#eAtk"),def:$("#eDef"),hpTxt:$("#eHpTxt"),mpTxt:$("#eMpTxt"),hpBar:$("#eHpBar"),mpBar:$("#eMpBar")};
  const battleStatusUI={
    ally:{
      lvl:$("#battleAllyLvl"),
      atk:$("#battleAllyAtk"),
      magic:$("#battleAllyMagic"),
      hpPct:$("#battleAllyHpPct"), hpVal:$("#battleAllyHpVal"), hpBar:$("#battleAllyHpBar"),
      mpPct:$("#battleAllyMpPct"), mpVal:$("#battleAllyMpVal"), mpBar:$("#battleAllyMpBar")
    },
    enemy:{
      name:$("#battleEnemyName"), lvl:$("#battleEnemyLvl"),atk:$("#battleEnemyAtk"),// 🆕 敵方攻擊
      def:$("#battleEnemyDef"),          // 🆕 敵方防禦
      hpPct:$("#battleEnemyHpPct"), hpVal:$("#battleEnemyHpVal"), hpBar:$("#battleEnemyHpBar"),
      mpPct:$("#battleEnemyMpPct"), mpVal:$("#battleEnemyMpVal"), mpBar:$("#battleEnemyMpBar")
    }
  };

    // 「更多功能…」：選項選到後，幫忙觸發對應按鈕
  const moreMenu = $("#moreMenu");
  if(moreMenu){
    moreMenu.addEventListener("change", e=>{
      const id = e.target.value;
      if(id){
        const btn = document.getElementById(id);
        if(btn) btn.click();
        e.target.value = ""; // 用完清空，方便下次選
      }
    });
  }


  const NOW=()=>Date.now();


  /* ========= 常數與資料 ========= */
  const REBIRTH_LVL = 200;
 // 正式品階：白>綠>藍>黃>橘>紫（神器獨立）
// 品質階級：多一階「神器」
const QUALS=["白","綠","藍","黃","橘","紫","神器"];
const QUAL_CLASS=["q-white","q-green","q-blue","q-yellow","q-orange","q-purple","q-arti"];
const QUALITY_ORDER={白:0,綠:1,藍:2,黃:3,橘:4,紫:5,神器:6};


// === 低階固定素質（依「部位」分別定義，可自行調整） ===
const FIXED_LOW_TIER = {
  weapon: { // 白/綠/藍固定值
    白:{atk:0, def:0,  hp:0,  mp:0, str:0, agi:0, int:0, spi:0},
    綠:{atk:0, def:0,  hp:0,  mp:0, str:0, agi:0, int:0, spi:0},
    藍:{atk:0, def:0,  hp:0,  mp:0, str:0, agi:0, int:0, spi:0}
  },
  armor: {
    白:{atk:0,  def:0,  hp:0, mp:0, str:0, agi:0, int:0, spi:0},
    綠:{atk:0,  def:0,  hp:0, mp:0, str:0, agi:0, int:0, spi:0},
    藍:{atk:0,  def:0,  hp:0, mp:0, str:0, agi:0, int:0, spi:0}
  },
  acc:{
    白:{atk:0,  def:0,  hp:0, mp:0, str:0, agi:0, int:0, spi:0},
    綠:{atk:0,  def:0,  hp:0, mp:0, str:0, agi:0, int:0, spi:0},
    藍:{atk:0,  def:0,  hp:0, mp:0, str:0, agi:0, int:0, spi:0}
  }
};
// === 強化規則定義 ===
// 每 +1 的素質增量
const PLUS_DELTA = {
  藍:{atk:0, def:0, hp:0, mp:0, str:1, agi:1, int:1, spi:1},
  黃:{atk:0, def:0, hp:0, mp:0, str:1, agi:1, int:1, spi:1},
  橘:{atk:0, def:0, hp:0, mp:0, str:1, agi:1, int:1, spi:1},
  紫:{atk:0, def:0, hp:0, mp:0, str:1, agi:1, int:1, spi:1},
  神器:{atk:5, def:4, hp:20, mp:12} // 神器獨立用
};

// 強化成功率（依品階、星數段）
const ENH_RATE = {
  藍:   p => (p<=5?0.70 : 0.65),
  黃:   p => (p<=5?0.60 : 0.55),
  橘:   p => (p<=5?0.50 : 0.45),
  紫:   (p,stars)=> {
    if(stars===0) return (p<=5?0.45:0.40);
    if(stars===1) return 0.40;
    if(stars===2) return 0.35;
    if(stars===3) return 0.30;
    if(stars===4) return 0.25;
    if(stars>=5)  return 0.20;
  },
  神器:(p,stars)=>{
    let base;
    if(stars===0) base = 0.35;
    if(stars===1) base = 0.30;
    if(stars===2) base = 0.25;
    if(stars===3) base = 0.20;
    if(stars===4) base = 0.15;
    if(stars>=5)  base = 0.10;
    // ㄅㄅㄐ之錘每顆 +1%
    return Math.min(0.99, base + 0.01*(game.buffs?.artiHammer||0));
  }
};

// 失敗是否掉階（以及機率）
const FAIL_BEHAVIOR = {
  藍:   ()=>({ drop:true, rate:0.20 }),                          
  黃:   ()=>({ drop:true,  rate:0.50 }),
  橘:   ()=>({ drop:true,  rate:0.70 }),
  紫:   (stars)=>({ drop:true, rate: stars===0?0.70 : [0.70,0.70,0.75,0.75,0.80][Math.min(stars,5)-1] }),
  神器:(stars)=>({ drop:true, rate: stars===0?0.80 : [0.80,0.80,0.85,0.85,0.90][Math.min(stars,5)-1] })
};

// 升級邏輯：藍/黃/橘 +10 升下一階（弱化詞條*1）；紫 +10 → 星數+1、plus歸0（最多5星）
function onReachPlusTen(inst){
  const q = inst.qual;
  if(q==="藍"){ inst.qual="黃"; inst.plus=0; addWeakAffix(inst,1); return "藍→黃"; }
  if(q==="黃"){ inst.qual="橘"; inst.plus=0; addWeakAffix(inst,1); return "黃→橘"; }
  if(q==="橘"){ inst.qual="紫"; inst.plus=0; addWeakAffix(inst,1); inst.stars=0; return "橘→紫"; }
  if(q==="紫"){
    inst.stars = Math.min(5,(inst.stars||0)+1);
    inst.plus  = 0;
    return `紫升星 → ${inst.stars}☆`;
  }
  return "";
}

// 弱化版詞條（你可在 addRandomAffix 內做弱化處理）
function addWeakAffix(inst, n=1){
  for(let i=0;i<n;i++){
    if(typeof addRandomAffix==="function"){
      addRandomAffix(inst);
    }
  }
}

  
  // =============================
// 🟣 神器命名器：依部位/武器類型生成名稱
// =============================
const ARTIFACT_NAME_LIB = {
  prefix: ["星墜","冰封","深淵","焰心","黎明","暮影","靈泉","雷紋","夢魘","寂光","白銀","蒼穹","虛空","聖裁","暗月"],
  suffix: ["的低語","之誓","的枷鎖","的迴響","之影","之祈","的斷章","的心臟","之環","之印","的祝福","的宿命"],
  base: {
    weapon: {
      blade:  ["審判長劍","斬裂之刃","白狼細劍","破曉闊劍","裁決大劍"],
      dagger: ["夜行匕首","蛇牙短刃","影縫之刺","無聲之刃","獵月短刀"],
      staff:  ["星吟法杖","霜語長杖","魂燈權杖","靈潮長杖","雷唱權杖"],
      focus:  ["星核吊墜","靈紋水晶","霜心魔球","燼脈法核"],
      tome:   ["星痕魔典","虛織咒頁","霜符古籍","深淵啟示錄"],
      bow:    ["裂風長弓","落星長弓","白羽神弓","森語影弓"],
      crossbow:["碎鳴重弩","影襲手弩","連射鎖弩","晦暗弩弓"],
      any:    ["遺落武器"]
    },
    armor: { any: ["白狼胸甲","霜紋鎧","星砂長袍","深寒皮甲","誓約戰袍","鳶影外套","蒼星護胸"] },
    acc:   { any: ["遠旅戒","回音之環","霧語吊墜","晨星耳飾","靈印手環","蒐魂勳章","月潮項鍊"] }
  }
};
const WEAPON_SPEED = {
  "吊墜": "快",
  "水晶球": "慢",
  "魔法書": "快",
  "法杖": "慢",
  "短劍盾": "快",
  "長劍盾": "慢",
  "雙刀": "快",
  "刺刀": "慢",
  "爪": "快",
  "暗器": "慢",
  "長弓": "快",
  "短弓": "慢",
  "手弩": "快",
  "重弩": "慢"
};
const CLASS_WEAPONS = {
  Warrior:["短劍盾","長劍盾"],
  Mage:["吊墜","水晶球","魔法書","法杖"],
  Assassin:["雙刀","刺刀","爪","暗器"],
  Ranger:["長弓","短弓","手弩","重弩"]
};
const CLASS_ARMORS = {
  Warrior:["盔甲"],
  Mage:["長袍"],
  Assassin:["皮甲"],
  Ranger:["皮衣"]
};
const CLASS_ACCESSORIES = {
  Warrior:["披風"],
  Mage:["戒指"],
  Assassin:["腰鍊"],
  Ranger:["耳環"]
};
const ARTIFACT_WEAPON_KEY = {
  "短劍盾": "blade",
  "長劍盾": "blade",
  "吊墜": "focus",
  "水晶球": "focus",
  "魔法書": "tome",
  "法杖": "staff",
  "雙刀": "dagger",
  "刺刀": "dagger",
  "爪": "dagger",
  "暗器": "dagger",
  "長弓": "bow",
  "短弓": "bow",
  "手弩": "crossbow",
  "重弩": "crossbow"
};
function rndPick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function artifactBaseName(slot, weapon){
  if (slot === "weapon"){
    const lib = ARTIFACT_NAME_LIB.base.weapon;
    const key = ARTIFACT_WEAPON_KEY[weapon] || weapon;
    if (key && lib[key]) return rndPick(lib[key]);
    return rndPick(lib.any);
  }
  if (slot === "armor") return rndPick(ARTIFACT_NAME_LIB.base.armor.any);
  return rndPick(ARTIFACT_NAME_LIB.base.acc.any);
}
function inferPrefixByContext(){
  try{
    const z = currentZone?.() || {};
    const name = (z.name || "").toString();
    if (/冰|雪|寒|霜/.test(name)) return "冰封";
    if (/深淵|黑|暗|影/.test(name)) return "暗月";
    if (/星|空|天/.test(name)) return "星墜";
    if (/火|炎|焰/.test(name)) return "焰心";
  }catch(e){}
  return rndPick(ARTIFACT_NAME_LIB.prefix);
}
function generateArtifactName(slot, weapon){
  const pre = inferPrefixByContext();
  const base = artifactBaseName(slot, weapon);
  const suf = Math.random() < 0.6 ? rndPick(ARTIFACT_NAME_LIB.suffix) : "";
  return suf ? `${pre}·${base}${suf}` : `${pre}·${base}`;
}
function ensureUniqueName(name){
  if(!window.__artifactNamePool) window.__artifactNamePool = {};
  const pool = window.__artifactNamePool;
  if(!pool[name]){ pool[name]=1; return name; }
  pool[name]++;
  const roman = [""," Ⅱ"," Ⅲ"," Ⅳ"," Ⅴ"," Ⅵ"," Ⅶ"," Ⅷ"," Ⅸ"," Ⅹ"];
  const idx = Math.min(pool[name], roman.length-1);
  return name + roman[idx];
}
//神器命名器------------------------
  
  const JOB_TREE=[
    {tier:0,key:"Novice", name:"初心者"},

    // 1 轉
    {tier:1,key:"Warrior", name:"戰士", parent:"Novice", weapon:"長劍盾", passive:"武勇", start:["ArmorBreak"]},
    {tier:1,key:"Mage",    name:"法師", parent:"Novice", weapon:"法杖", passive:"星識", start:["ManaShot"]},
    {tier:1,key:"Assassin",name:"刺客", parent:"Novice", weapon:"刺刀", passive:"潛匿", start:["SwiftSlash"]},
    {tier:1,key:"Ranger",  name:"弓手", parent:"Novice", weapon:"長弓", passive:"野獵", start:["QuickShot"]},

    // 戰士系
    {tier:2,key:"Berserker",        name:"狂血戰士", parent:"Warrior", weapon:"長劍盾", passive:"武勇", start:["ArmorBreak"]},
    {tier:3,key:"BloodflameReaver", name:"血焰狂刃", parent:"Berserker", weapon:"長劍盾", passive:"武勇", start:["ArmorBreak"]},
    {tier:4,key:"Warshura",         name:"嗜戰修羅", parent:"BloodflameReaver", weapon:"長劍盾", passive:"武勇", start:["ArmorBreak"]},

    {tier:2,key:"Steelheart",       name:"鋼心戰士", parent:"Warrior", weapon:"長劍盾", passive:"武勇", start:["ArmorBreak"]},
    {tier:3,key:"EdgewallKnight",   name:"鋒壁騎士", parent:"Steelheart", weapon:"長劍盾", passive:"武勇", start:["ArmorBreak"]},
    {tier:4,key:"BulwarkWarlord",   name:"破陣戰君", parent:"EdgewallKnight", weapon:"長劍盾", passive:"武勇", start:["ArmorBreak"]},

    // 法師系
    {tier:2,key:"ElementWeaver",    name:"元素編織者", parent:"Mage", weapon:"法杖", passive:"星識", start:["ManaShot"]},
    {tier:3,key:"ArcaneConductor",  name:"秘法咒導師", parent:"ElementWeaver", weapon:"法杖", passive:"星識", start:["ManaShot"]},
    {tier:4,key:"AstralArchmage",   name:"天紋魔導師", parent:"ArcaneConductor", weapon:"法杖", passive:"星識", start:["ManaShot"]},

    {tier:2,key:"StarshadeCaster",  name:"星影咒師", parent:"Mage", weapon:"法杖", passive:"星識", start:["ManaShot"]},
    {tier:3,key:"LunarisArcanist",  name:"月寂導法者", parent:"StarshadeCaster", weapon:"法杖", passive:"星識", start:["ManaShot"]},
    {tier:4,key:"NoxAbyssEmperor",  name:"夜墟星淵帝", parent:"LunarisArcanist", weapon:"法杖", passive:"星識", start:["ManaShot"]},

    // 刺客系
    {tier:2,key:"Shadowblade",      name:"影刃者", parent:"Assassin", weapon:"刺刀", passive:"潛匿", start:["SwiftSlash"]},
    {tier:3,key:"NightReaver",      name:"夜影斬", parent:"Shadowblade", weapon:"刺刀", passive:"潛匿", start:["SwiftSlash"]},
    {tier:4,key:"AbyssShadereaver", name:"闇刃修羅", parent:"NightReaver", weapon:"刺刀", passive:"潛匿", start:["SwiftSlash"]},

    {tier:2,key:"ShadeMark",        name:"暗印者", parent:"Assassin", weapon:"刺刀", passive:"潛匿", start:["SwiftSlash"]},
    {tier:3,key:"ShadowDevourer",   name:"影噬者", parent:"ShadeMark", weapon:"刺刀", passive:"潛匿", start:["SwiftSlash"]},
    {tier:4,key:"UmbralAshura",     name:"幽噬修羅", parent:"ShadowDevourer", weapon:"刺刀", passive:"潛匿", start:["SwiftSlash"]},

    // 弓手系
    {tier:2,key:"WindHunter",       name:"獵風者", parent:"Ranger", weapon:"長弓", passive:"野獵", start:["QuickShot"]},
    {tier:3,key:"Chaser",           name:"追獵者", parent:"WindHunter", weapon:"長弓", passive:"野獵", start:["QuickShot"]},
    {tier:4,key:"DeicideRanger",    name:"獵神者", parent:"Chaser", weapon:"長弓", passive:"野獵", start:["QuickShot"]},

    {tier:2,key:"UmbralCrossbowman",name:"冥弩使", parent:"Ranger", weapon:"長弓", passive:"野獵", start:["QuickShot"]},
    {tier:3,key:"UmbralBoltReaver", name:"冥矢獵者", parent:"UmbralCrossbowman", weapon:"長弓", passive:"野獵", start:["QuickShot"]},
    {tier:4,key:"UmbralHuntshura",  name:"冥狩修羅", parent:"UmbralBoltReaver", weapon:"長弓", passive:"野獵", start:["QuickShot"]},
  ];
  const ROOT_JOBS = ["Warrior","Mage","Assassin","Ranger"];
  function jobSeries(job){
    if(job === "Novice") return "Novice";
    let node = JOB_TREE.find(x=>x.key===job);
    while(node){
      if(ROOT_JOBS.includes(node.key)) return node.key;
      node = JOB_TREE.find(x=>x.key===node.parent);
    }
    return null;
  }
  function isJobInLineage(job, target){
    if(!job || !target) return false;
    if(job === target) return true;
    let node = JOB_TREE.find(x=>x.key===job);
    while(node && node.parent){
      if(node.parent === target) return true;
      node = JOB_TREE.find(x=>x.key===node.parent);
    }
    return false;
  }
  const ALL_WEAPONS = Object.values(CLASS_WEAPONS).flat();
  const JOB_WEAPON=JOB_TREE.reduce((acc, job)=>{
    const series = jobSeries(job.key);
    acc[job.key] = series && series !== "Novice" ? (CLASS_WEAPONS[series]||[]) : ALL_WEAPONS;
    return acc;
  },{});
  function inferEquipSeries(inst){
    if(!inst) return null;
    const name = inst.name || inst.weapon;
    for(const [series, names] of Object.entries(CLASS_ARMORS)){
      if(names.includes(name)) return series;
    }
    for(const [series, names] of Object.entries(CLASS_ACCESSORIES)){
      if(names.includes(name)) return series;
    }
    return inst.bindSeries || null;
  }


  // 技能
  function scaleByLevel(lv, min, max, cap=10){
    const cur = clamp(lv, 1, cap);
    if(cap <= 1) return max;
    return min + (max - min) * ((cur - 1) / (cap - 1));
  }
  function physicalSkillHit(p,e,min,max,lv){
    const effDef = effectiveEnemyDef(e,p);
    const base = Math.max(1, rnd(p.atk-2, p.atk+2) - effDef);
    let dmg = Math.floor(base * scaleByLevel(lv, min, max));
    dmg = critMaybe(p, dmg, "physical");
    dmg = applySpeedBonus(p, dmg);
    dmg = Math.floor(dmg * berserkerAtkBuffMultiplier());
    return Math.max(1, dmg);
  }
  function magicSkillHit(p,e,min,max,lv){
    const effDef = effectiveEnemyDef(e,p);
    const base = Math.max(1, rnd(p.magicAtk-3, p.magicAtk+1) + Math.floor(p.maxmp * 0.02) - Math.floor(effDef * 0.7));
    let dmg = Math.floor(base * scaleByLevel(lv, min, max));
    dmg = critMaybe(p, dmg, "magic");
    dmg = applySpeedBonus(p, dmg);
    return Math.max(1, dmg);
  }

  const SKILL={
 // ===== 初心者：主動技能 =====
    basicSlash:{
      id:"basicSlash",
      name:"斬擊基礎（Basic Slash）",
      type:"主動",
      acquisition:"point",
      maxLv:3,
      baseMp:3,
      desc:"運用基礎戰鬥技巧，以武器施展穩定的物理斬擊。",
      use(p,e,lv){
        if(!e) return false;
        const cost = calcSkillCost(p, this.baseMp);
        if(p.mp < cost){ say("MP 不足。"); return false; }
        p.mp -= cost;

        const dmg = physicalSkillHit(p, e, 1.05, 1.3, lv);
        e.hp = clamp(e.hp - dmg, 0, e.maxhp);
        affixOnHit(p, e, dmg);
        say(`🗡️ 你施展<b>斬擊基礎</b>（Lv.${lv}），造成 <span class="hp">-${dmg}</span>。`);
        recoverManaOnAction(p);
        return true;
      }
    },

    manaSpark:{
      id:"manaSpark",
      name:"魔能火花（Mana Spark）",
      type:"主動",
      acquisition:"point",
      maxLv:3,
      baseMp:4,
      desc:"釋放低階魔力火花，造成單體魔法傷害。",
      use(p,e,lv){
        if(!e) return false;
        const cost = calcSkillCost(p, this.baseMp);
        if(p.mp < cost){ say("MP 不足。"); return false; }
        p.mp -= cost;

        const dmg = magicSkillHit(p, e, 1.05, 1.32, lv);
        e.hp = clamp(e.hp - dmg, 0, e.maxhp);
        affixOnHit(p, e, dmg);
        say(`✨ 你釋放<b>魔能火花</b>（Lv.${lv}），造成 <span class="hp">-${dmg}</span> 魔法傷害。`);
        recoverManaOnAction(p);
        return true;
      }
    },

 // ===== 初心者：預備心法（被動） =====
    powerFundamentals:{
      id:"powerFundamentals",
      name:"力量入門（Power Fundamentals）",
      type:"被動",
      acquisition:"point",
      maxLv:3,
      desc:"學習基本運力技巧，微幅提升物理穩定度。",
    },

    agilityFundamentals:{
      id:"agilityFundamentals",
      name:"敏捷入門（Agility Fundamentals）",
      type:"被動",
      acquisition:"point",
      maxLv:3,
      desc:"敏捷訓練，讓身體反應更迅速輕盈。",
    },

    accuracyFundamentals:{
      id:"accuracyFundamentals",
      name:"精準入門（Accuracy Fundamentals）",
      type:"被動",
      acquisition:"point",
      maxLv:3,
      desc:"基礎準心鍛鍊，使遠程攻擊更穩定。",
    },

    arcaneFundamentals:{
      id:"arcaneFundamentals",
      name:"魔導入門（Arcane Fundamentals）",
      type:"被動",
      acquisition:"point",
      maxLv:3,
      desc:"基礎魔導訓練，提升魔力操控順暢度。",
    },

 // ===== 初心者：特殊技能 =====
    insight:{
      id:"insight",
      name:"洞察（Insight）",
      type:"特殊",
      acquisition:"point",
      maxLv:3,
      desc:"敏銳觀察怪物行動與氣息，獲得額外情報。",
    },

// 🗡️ Assassin — 1 轉技能
SwiftSlash: {
  id:"SwiftSlash",
  name:"迅刃",
  desc:"快速揮出短刃攻擊，造成單體物理傷害。",
  acquisition:"point",
  maxLv:10, tier:1, tree:"Assassin", type:"active", baseMp:4,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const dmg = physicalSkillHit(p, e, 1.1, 1.8, lv);
    e.hp = clamp(e.hp - dmg, 0, e.maxhp);
    affixOnHit(p, e, dmg);
    say(`🥷 你使出<b>迅刃</b>（Lv.${lv}），造成 <span class="hp">-${dmg}</span>。`);
    recoverManaOnAction(p);
    return true;
  }
},
VitalStab: {
  id:"VitalStab",
  name:"要害突刺",
  desc:"瞄準要害的刺擊，造成較高物理傷害。",
  acquisition:"point",
  maxLv:10, tier:1, tree:"Assassin", type:"active", baseMp:5,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp+1);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const dmg = physicalSkillHit(p, e, 1.2, 2.0, lv);
    e.hp = clamp(e.hp - dmg, 0, e.maxhp);
    affixOnHit(p, e, dmg);
    say(`🎯 <b>要害突刺</b>擊中要點，造成 <span class="hp">-${dmg}</span>。`);
    recoverManaOnAction(p);
    return true;
  }
},
ExposeStrike: {
  id:"ExposeStrike",
  name:"破綻擊",
  desc:"造成物傷並使敵人防禦下降（2 回合）。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Assassin", type:"debuff", baseMp:5,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const dmg = physicalSkillHit(p, e, 1.05, 1.5, lv);
    e.hp = clamp(e.hp - dmg, 0, e.maxhp);
    e.defDown = Math.max(e.defDown || 0, 0.22);
    e.defDownTurns = 2;
    affixOnHit(p, e, dmg);
    say(`🔻 你以<b>破綻擊</b>打亂敵形，造成 <span class="hp">-${dmg}</span>，防禦下降。`);
    recoverManaOnAction(p);
    return true;
  }
},
ShadowstepBasic: {
  id:"ShadowstepBasic",
  name:"閃步",
  desc:"降低敵方本回合命中率。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Assassin", type:"survival", baseMp:3,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    e.hitDown = Math.max(e.hitDown || 0, 0.22 + 0.02*(lv-1));
    e.hitDownTurns = 1;
    say(`💨 你施展<b>閃步</b>，本回合敵人更難命中你。`);
    recoverManaOnAction(p);
    return true;
  }
},
BreakForm: {
  id:"BreakForm",
  name:"拆招",
  desc:"干擾敵人攻擊，使其本回合攻擊下降。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Assassin", type:"survival", baseMp:4,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    e.atkDown = Math.max(e.atkDown || 0, 0.18 + 0.02*(lv-1));
    e.atkDownTurns = 1;
    say(`🌀 你拆解敵招，本回合攻勢減弱。`);
    recoverManaOnAction(p);
    return true;
  }
},
BladeMastery: {
  id:"BladeMastery",
  name:"刀術熟練",
  desc:"提升短刀掌握度，使攻擊更穩定、命中更易。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Assassin", type:"passive"
},
AgilityTraining: {
  id:"AgilityTraining",
  name:"敏捷訓練",
  desc:"提升反應速度，提高閃避能力。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Assassin", type:"passive"
},
SilentFocus: {
  id:"SilentFocus",
  name:"冷靜專注",
  desc:"提升命中或暴擊穩定度。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Assassin", type:"passive"
},

// 🏹 Archer — 1 轉技能
QuickShot:{
  id:"QuickShot",
  name:"速射",
  desc:"快速射出一箭，造成物理傷害。",
  acquisition:"point",
  maxLv:10, tier:1, tree:"Ranger", type:"active", baseMp:4,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const dmg = physicalSkillHit(p, e, 1.12, 1.75, lv);
    e.hp = clamp(e.hp - dmg, 0, e.maxhp);
    affixOnHit(p, e, dmg);
    say(`🏹 你施放<b>速射</b>（Lv.${lv}），造成 <span class="hp">-${dmg}</span>。`);
    recoverManaOnAction(p);
    return true;
  }
},
ChargedShot:{
  id:"ChargedShot",
  name:"蓄力射擊",
  desc:"蓄力發射強力一箭，造成較高物理傷害。",
  acquisition:"point",
  maxLv:10, tier:1, tree:"Ranger", type:"active", baseMp:6,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const dmg = physicalSkillHit(p, e, 1.2, 2.0, lv);
    e.hp = clamp(e.hp - dmg, 0, e.maxhp);
    affixOnHit(p, e, dmg);
    say(`🎯 你蓄力放出<b>蓄力射擊</b>（Lv.${lv}），造成 <span class="hp">-${dmg}</span>。`);
    recoverManaOnAction(p);
    return true;
  }
},
SoftSpotShot:{
  id:"SoftSpotShot",
  name:"弱化射擊",
  desc:"瞄準脆弱處，使敵人防禦下降（2 回合）。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Ranger", type:"debuff", baseMp:5,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const dmg = physicalSkillHit(p, e, 1.05, 1.45, lv);
    e.hp = clamp(e.hp - dmg, 0, e.maxhp);
    e.defDown = Math.max(e.defDown || 0, 0.22 + 0.01*(lv-1));
    e.defDownTurns = 2;
    affixOnHit(p, e, dmg);
    say(`🎯 <b>弱化射擊</b>造成 <span class="hp">-${dmg}</span>，並削弱防禦。`);
    recoverManaOnAction(p);
    return true;
  }
},
DodgeRoll:{
  id:"DodgeRoll",
  name:"翻滾迴避",
  desc:"翻滾閃避攻擊，本回合受到的傷害下降。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Ranger", type:"survival", baseMp:3,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    game.state.guardMitigation = { ratio: 0.30 + 0.05*(lv-1), turns: 1 };
    say(`🌀 你翻滾閃避，暫時降低所受傷害。`);
    recoverManaOnAction(p);
    return true;
  }
},
DecoyTrick:{
  id:"DecoyTrick",
  name:"誘餌術",
  desc:"干擾敵人，使其命中率下降。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Ranger", type:"survival", baseMp:4,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    e.hitDown = Math.max(e.hitDown || 0, 0.25 + 0.02*(lv-1));
    e.hitDownTurns = 1;
    say(`🎭 誘餌吸引了敵人注意，牠的攻擊更容易落空。`);
    recoverManaOnAction(p);
    return true;
  }
},
BowMastery:{
  id:"BowMastery",
  name:"弓術熟練",
  desc:"提升射擊穩定度，使傷害更一致。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Ranger", type:"passive"
},
AgileFootwork:{
  id:"AgileFootwork",
  name:"敏捷步伐",
  desc:"提升步伐靈活性，更容易閃避攻擊。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Ranger", type:"passive"
},
SteadyBreath:{
  id:"SteadyBreath",
  name:"專注呼吸",
  desc:"提升攻擊穩定性，減少射擊誤差。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Ranger", type:"passive"
},

// 🔮 Mage — 1 轉技能
ManaShot:{
  id:"ManaShot",
  name:"魔力彈",
  desc:"發射初級魔力彈造成魔法傷害。",
  acquisition:"point",
  maxLv:10, tier:1, tree:"Mage", type:"active", baseMp:5,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const dmg = magicSkillHit(p, e, 1.1, 1.9, lv);
    e.hp = clamp(e.hp - dmg, 0, e.maxhp);
    affixOnHit(p, e, dmg);
    say(`🔮 你射出<b>魔力彈</b>（Lv.${lv}），造成 <span class="hp">-${dmg}</span> 魔法傷害。`);
    recoverManaOnAction(p);
    return true;
  }
},
ManaShock:{
  id:"ManaShock",
  name:"法力震盪",
  desc:"干擾敵方魔力，使其更容易受到魔法傷害（2 回合）。",
  acquisition:"point",
  maxLv:10, tier:1, tree:"Mage", type:"buff", baseMp:5,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const dmg = magicSkillHit(p, e, 1.05, 1.6, lv);
    e.hp = clamp(e.hp - dmg, 0, e.maxhp);
    e.defDown = Math.max(e.defDown || 0, 0.2 + 0.01*Math.min(5, lv));
    e.defDownTurns = 2;
    affixOnHit(p, e, dmg);
    say(`💫 <b>法力震盪</b>造成 <span class="hp">-${dmg}</span>，敵方魔抗被撼動。`);
    recoverManaOnAction(p);
    return true;
  }
},
Bind:{
  id:"Bind",
  name:"束縛術",
  desc:"束縛敵人，使其攻擊或速度下降。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Mage", type:"control", baseMp:4,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const dmg = magicSkillHit(p, e, 0.9, 1.3, lv);
    e.hp = clamp(e.hp - dmg, 0, e.maxhp);
    e.hitDown = Math.max(e.hitDown || 0, 0.2 + 0.03*(lv-1));
    e.hitDownTurns = 1;
    e.atkDown = Math.max(e.atkDown || 0, 0.15 + 0.02*(lv-1));
    e.atkDownTurns = 1;
    affixOnHit(p, e, dmg);
    say(`⛓️ <b>束縛術</b>使敵人動作遲緩，並造成 <span class="hp">-${dmg}</span>。`);
    recoverManaOnAction(p);
    return true;
  }
},
ArcaneWard:{
  id:"ArcaneWard",
  name:"魔法護盾術",
  desc:"形成護盾，吸收部分傷害。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Mage", type:"defense", baseMp:4,
  use(p){
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const shield = Math.max(3, Math.floor(p.maxhp * (0.08 + 0.02*skillLevel(this.id,1))));
    game.state.playerShield = Math.min(p.maxhp, (game.state.playerShield||0) + shield);
    say(`🛡️ 魔法護盾展開，可吸收 <b>${shield}</b> 傷害。`);
    recoverManaOnAction(p);
    return true;
  }
},
ManaShield:{
  id:"ManaShield",
  name:"魔力護盾",
  desc:"受到傷害時優先扣 MP。轉職自動給 Lv1。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Mage", type:"passive"
},
ArcaneMastery:{
  id:"ArcaneMastery",
  name:"奧術熟練",
  desc:"提升施法精準度與傷害穩定性。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Mage", type:"passive"
},
MeditationFocus:{
  id:"MeditationFocus",
  name:"精神專注",
  desc:"提升回魔或最大 MP。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Mage", type:"passive"
},

// 🛡 Warrior — 1 轉技能
ArmorBreak:{
  id:"ArmorBreak",
  name:"破甲斬",
  desc:"造成物傷並降低敵人防禦（2 回合）。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Warrior", type:"debuff", baseMp:5,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const dmg = physicalSkillHit(p, e, 1.12, 1.6, lv);
    e.hp = clamp(e.hp - dmg, 0, e.maxhp);
    e.defDown = Math.max(e.defDown || 0, 0.22 + 0.01*(lv-1));
    e.defDownTurns = 2;
    affixOnHit(p, e, dmg);
    say(`🪓 <b>破甲斬</b>劈開護甲，造成 <span class="hp">-${dmg}</span> 並削弱防禦。`);
    recoverManaOnAction(p);
    return true;
  }
},
RageStrike:{
  id:"RageStrike",
  name:"血怒斬擊",
  desc:"犧牲少量 HP 換取高傷害斬擊。",
  acquisition:"point",
  maxLv:10, tier:1, tree:"Warrior", type:"active", baseMp:6,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    const hpCost = Math.max(5, Math.floor(p.maxhp * 0.03));
    if(p.hp <= hpCost){ say("體力不足以施展。" ); return false; }
    p.mp -= cost;
    p.hp = Math.max(1, p.hp - hpCost);
    const dmg = physicalSkillHit(p, e, 1.25, 2.05, lv);
    e.hp = clamp(e.hp - dmg, 0, e.maxhp);
    affixOnHit(p, e, dmg);
    say(`💢 你以血怒揮擊，消耗 <b>${hpCost}</b> HP，造成 <span class="hp">-${dmg}</span>。`);
    recoverManaOnAction(p);
    return true;
  }
},
GuardCounter:{
  id:"GuardCounter",
  name:"鐵壁反擊",
  desc:"本回合減傷；如受到攻擊則反擊一次。",
  acquisition:"point",
  maxLv:10, tier:1, tree:"Warrior", type:"defense", baseMp:5,
  use(p){
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    game.state.guardMitigation = { ratio: 0.35 + 0.02*(skillLevel(this.id,1)-1), turns: 1 };
    game.state.counterReady = true;
    say(`🛡️ 你架起盾勢，準備反擊來襲。`);
    recoverManaOnAction(p);
    return true;
  }
},
VitalStrength:{
  id:"VitalStrength",
  name:"基礎體魄",
  desc:"提升最大 HP 或耐久度。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Warrior", type:"passive"
},
WeaponMastery:{
  id:"WeaponMastery",
  name:"武器熟練",
  desc:"提升命中與攻擊穩定度。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Warrior", type:"passive"
},
SteadfastFooting:{
  id:"SteadfastFooting",
  name:"堅毅步伐",
  desc:"提升抗控能力，使戰士不易被打斷。",
  acquisition:"point",
  maxLv:3, tier:1, tree:"Warrior", type:"passive"
},

// 🩸 Berserker — 2 轉技能
BloodshatterSlash:{
  id:"BloodshatterSlash",
  name:"狂血破甲斬（Bloodshatter Slash）",
  desc:"單體物理斬擊，破甲並以血為代價換取輸出。Lv.Max 10｜基礎傷害倍率隨等級提升，破甲約 22%→40%，持續 2～4 回合｜自殘為當前 HP 約 6%→12%｜HP 低於 50% 時額外提高傷害。",
  acquisition:"point",
  maxLv:10, tier:2, tree:"Berserker", type:"active", baseMp:10,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    const hpCostRate = scaleByLevel(lv, 0.06, 0.12, this.maxLv);
    const hpCost = Math.max(1, Math.floor(p.hp * hpCostRate));
    if(p.hp <= hpCost){ say("體力不足以施展。"); return false; }
    p.mp -= cost;
    const boost = consumeBloodUnleashSkillBoost();
    let dmg = physicalSkillHit(p, e, 1.35, 2.45, lv);
    dmg = Math.floor(dmg * boost);
    const hpPct = (p.hp || 0) / Math.max(1, p.maxhp || 1);
    if(hpPct < 0.5){
      const lowBonus = 0.25 + 0.02*(lv-1);
      dmg = Math.floor(dmg * (1 + lowBonus));
    }
    e.hp = clamp(e.hp - dmg, 0, e.maxhp);
    const shred = scaleByLevel(lv, 0.22, 0.4, this.maxLv);
    const turns = 2 + Math.floor((lv-1)/3);
    e.defDown = Math.max(e.defDown || 0, shred);
    e.defDownTurns = Math.max(turns, e.defDownTurns || 0);
    p.hp = Math.max(1, p.hp - hpCost);
    affixOnHit(p, e, dmg);
    say(`🩸 你施展<b>狂血破甲斬</b>，犧牲 <b>${hpCost}</b> HP，造成 <span class="hp">-${dmg}</span> 並使防禦 -${Math.round(shred*100)}%（${turns} 回合）。`);
    recoverManaOnAction(p);
    recalcPlayerStats();
    return true;
  }
},
BloodfireCombo:{
  id:"BloodfireCombo",
  name:"焚血連斬（Bloodfire Combo）",
  desc:"多段物理連擊，HP 越低段數越多。基礎 2→5 段，HP <60% / <40% / <20% 各追加 1 段，單段倍率約 0.75→1.05，各段自損身體當前 HP 約 2%。冷卻偏長的爆發連打。",
  acquisition:"point",
  maxLv:20, tier:2, tree:"Berserker", type:"active", baseMp:14,
  use(p,e,lv){
    if(!e) return false;
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const baseHits = 2 + Math.floor((lv+2)/4);
    const hpPct = (p.hp || 0) / Math.max(1, p.maxhp || 1);
    let bonusHits = 0;
    if(hpPct < 0.6) bonusHits++;
    if(hpPct < 0.4) bonusHits++;
    if(hpPct < 0.2) bonusHits++;
    const totalHits = baseHits + bonusHits;
    const skillBoost = consumeBloodUnleashSkillBoost();
    let totalDmg = 0;
    let realHits = 0;
    for(let i=0;i<totalHits;i++){
      if(p.hp <= 1) break;
      const hpCostRate = 0.018 + 0.002*(lv-1);
      const hpCost = Math.max(1, Math.floor(p.hp * hpCostRate));
      const hitDmgBase = physicalSkillHit(p, e, 0.75, 1.05, lv);
      const hitDmg = Math.max(1, Math.floor(hitDmgBase * skillBoost));
      e.hp = clamp(e.hp - hitDmg, 0, e.maxhp);
      p.hp = Math.max(1, p.hp - hpCost);
      totalDmg += hitDmg;
      realHits++;
      affixOnHit(p, e, hitDmg);
      if(e.hp<=0) break;
    }
    say(`🔥 <b>焚血連斬</b>展開 ${realHits} 段攻勢，總計造成 <span class="hp">-${totalDmg}</span>（每段消耗自身 HP）。`);
    recoverManaOnAction(p);
    recalcPlayerStats();
    return true;
  }
},
WildHowl:{
  id:"WildHowl",
  name:"野性之吼（Wild Howl）",
  desc:"自身 Buff，提升物爆率、爆傷與行動值，持續數回合，但期間受到傷害增加。Lv.Max 5｜物爆率約 +8%→+16%、爆傷 +20%→+40%、行動值 +8%→+16%、承受傷害 +12%→+16%。",
  acquisition:"point",
  maxLv:5, tier:2, tree:"Berserker", type:"buff", baseMp:10,
  use(p){
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const lv = skillLevel(this.id,1);
    const critRate = 8 + 2*(lv-1);
    const critDmg = 0.2 + 0.05*(lv-1);
    const actionSpeed = 0.08 + 0.02*(lv-1);
    const dmgTaken = 0.12 + 0.01*(lv-1);
    const turns = 2 + Math.floor((lv+1)/2);
    game.state.wildHowl = {turns, critRate, critDmg, actionSpeed, dmgTaken};
    say(`🐺 你發出野性之吼（${turns} 回合）：物爆 +${critRate}%｜爆傷 +${Math.round(critDmg*100)}%｜行動值 +${Math.round(actionSpeed*100)}%｜受到傷害 +${Math.round(dmgTaken*100)}%。`);
    recoverManaOnAction(p);
    return true;
  }
},
BloodUnleash:{
  id:"BloodUnleash",
  name:"怒血解放（Blood Unleash）",
  desc:"短暫狂化：1 回合內大幅提升攻擊與行動值，下一個主動攻擊技能傷害額外乘上加成；期間受到的傷害提高，結束時扣除自身 HP。Lv.Max 5｜攻擊力 +25%→+45%｜行動值 +12%→+20%｜下一個攻擊技能 1.25→1.45 倍｜期間受傷 +18%→+26%，結束自損 8%→16% 最大 HP。",
  acquisition:"point",
  maxLv:5, tier:2, tree:"Berserker", type:"buff", baseMp:14,
  use(p){
    const cost = calcSkillCost(p, this.baseMp);
    if(p.mp < cost){ say("MP 不足。"); return false; }
    p.mp -= cost;
    const lv = skillLevel(this.id,1);
    const atkBoost = 0.25 + 0.05*(lv-1);
    const actionSpeed = 0.12 + 0.02*(lv-1);
    const skillBoost = 1.25 + 0.05*(lv-1);
    const dmgTaken = 0.18 + 0.02*(lv-1);
    const hpPenalty = 0.08 + 0.02*(lv-1);
    game.state.bloodUnleash = {turns:1, atkBoost, actionSpeed, skillBoost, dmgTaken, hpPenalty, skillConsumed:false};
    say(`🩸 <b>怒血解放</b>啟動：攻擊 +${Math.round(atkBoost*100)}%｜行動值 +${Math.round(actionSpeed*100)}%｜下個主動攻擊 x${skillBoost.toFixed(2)}，期間受傷 +${Math.round(dmgTaken*100)}%，結束後損失 ${Math.round(hpPenalty*100)}% HP。`);
    recoverManaOnAction(p);
    return true;
  }
},
BloodFrenzyBody:{
  id:"BloodFrenzyBody",
  name:"怒血之軀（Blood-Frenzy Body）",
  desc:"被動：依當前 HP% 提升攻擊與物爆率。HP <70% 小幅增益，<50% 中量提升，<30% 大幅提升；等級越高加成越高。",
  acquisition:"point",
  maxLv:5, tier:2, tree:"Berserker", type:"passive"
},
WarDrivenInstinct:{
  id:"WarDrivenInstinct",
  name:"嗜戰本能（War-Driven Instinct）",
  desc:"被動：同一場戰鬥內造成暴擊、受到傷害或擊殺時獲得 1 層「嗜戰」。每層提高攻擊與行動值，戰鬥結束清空。層數上限：Lv1=5｜Lv2=8｜Lv3=12｜Lv4=16｜Lv5=20。",
  acquisition:"point",
  maxLv:5, tier:2, tree:"Berserker", type:"passive"
}
  };

const SKILL_TIERS = {
  basicSlash:0,
  manaSpark:0,
  powerFundamentals:0,
  agilityFundamentals:0,
  accuracyFundamentals:0,
  arcaneFundamentals:0,
  insight:0,
  SwiftSlash:1,
  VitalStab:1,
  ExposeStrike:1,
  ShadowstepBasic:1,
  BreakForm:1,
  BladeMastery:1,
  AgilityTraining:1,
  SilentFocus:1,
  QuickShot:1,
  ChargedShot:1,
  SoftSpotShot:1,
  DodgeRoll:1,
  DecoyTrick:1,
  BowMastery:1,
  AgileFootwork:1,
  SteadyBreath:1,
  ManaShot:1,
  ManaShock:1,
  Bind:1,
  ArcaneWard:1,
  ManaShield:1,
  ArcaneMastery:1,
  MeditationFocus:1,
  ArmorBreak:1,
  RageStrike:1,
  GuardCounter:1,
  VitalStrength:1,
  WeaponMastery:1,
  SteadfastFooting:1,
  BloodshatterSlash:2,
  BloodfireCombo:2,
  WildHowl:2,
  BloodUnleash:2,
  BloodFrenzyBody:2,
  WarDrivenInstinct:2
};

  function skillTier(id){ return SKILL_TIERS[id] ?? 0; }
  function allowedSkillTiersForPlayer(){
    const tier = game.player?.tier || 0;
    if(tier >= 4) return [4,3,2,1,0];
    if(tier >= 3) return [3,2,1,0];
    if(tier >= 2) return [2,1,0];
    if(tier >= 1) return [1,0];
    return [0];
  }
  function checkSkillTierAllowed(id){
    const tier = skillTier(id);
    const allowed = allowedSkillTiersForPlayer();
    if(!allowed.includes(tier)){
      say("🔒 目前轉職階段無法強化這個技能（需符合職業解鎖規則）。");
      return false;
    }
    return true;
  }

  function skillLevel(id, fallback=0){
    const lv = game.player?.learned?.[id];
    return typeof lv === "number" ? lv : fallback;
  }
  function skillMaxLv(id){
    const sk = SKILL[id];
    return sk?.maxLv || SKILL_MAX_LV;
  }
// ===【經驗加倍捲倍率】===
// 1.00 = 每層 +100%（原本行為）
// 0.50 = 每層 +50%（建議）
// 0.75 = 每層 +75% ……自行調整
const XP_SCROLL_RATE = 2.0; 

  // 物品 / 裝備 / 坐騎 / 加倍捲
  const itemDefs={
    "小治療藥水":{type:"consum",desc:"回復 20~50 HP", use:(p)=>{ const v=rnd(20,50); p.hp=clamp(p.hp+v,0,p.maxhp); say(`你使用 <b>小治療藥水</b>，回復 <b>${v} HP</b>。`);} },
    "中治療藥水":{type:"consum",desc:"回復 150~300 HP", use:(p)=>{ const v=rnd(150,300); p.hp=clamp(p.hp+v,0,p.maxhp); say(`你使用 <b>中治療藥水</b>，回復 <b>${v} HP</b>。`);} }, // [NEW]
    "大治療藥水":{type:"consum",desc:"回復 500~750 HP", use:(p)=>{ const v=rnd(500,750); p.hp=clamp(p.hp+v,0,p.maxhp); say(`你使用 <b>大治療藥水</b>，回復 <b>${v} HP</b>。`);} }, // [NEW]
    "特級治療藥水":{type:"consum",desc:"回復 50% HP", use:(p)=>{ const v=Math.ceil(p.maxhp*0.5); p.hp=clamp(p.hp+v,0,p.maxhp); say(`你使用 <b>特級治療藥水</b>，回復 <b>${v} HP</b>。`);} }, // [NEW]
    "小魔力藥水":{type:"consum",desc:"回復 20~50 MP",  use:(p)=>{ const v=rnd(20,50); p.mp=clamp(p.mp+v,0,p.maxmp); say(`你使用 <b>小魔力藥水</b>，回復 <b>${v} MP</b>。`);} },
    "中魔力藥水":{type:"consum",desc:"回復 150~300 MP", use:(p)=>{ const v=rnd(150,300); p.mp=clamp(p.mp+v,0,p.maxmp); say(`你使用 <b>中魔力藥水</b>，回復 <b>${v} MP</b>。`);} },
    "大魔力藥水":{type:"consum",desc:"回復 500~750 MP", use:(p)=>{ const v=rnd(500,750); p.mp=clamp(p.mp+v,0,p.maxmp); say(`你使用 <b>大魔力藥水</b>，回復 <b>${v} MP</b>。`);} },
    "特級魔力藥水":{type:"consum",desc:"回復 50% MP", use:(p)=>{ const v=Math.ceil(p.maxmp*0.5); p.mp=clamp(p.mp+v,0,p.maxmp); say(`你使用 <b>特級魔力藥水</b>，回復 <b>${v} MP</b>。`);} },
        "任務藥水": {
      type:"consum",
      desc:"任務專用道具，可交付給任務換取報酬。",
      use:(p)=>{
        // 可以選擇「不能直接喝」，只做提示
        say("這是一瓶任務藥水，請交給相關任務使用。");
      }
    },

    "煙霧彈":{type:"consum",desc:"戰鬥中嘗試脫離",  use:(p,e,inBattle)=>{ if(inBattle){ say("你投擲了煙霧彈！你逃離了戰鬥。"); endBattle(false); } else { say("你在空地放了煙……好像有點招搖。"); } }},
    "經驗加倍捲":{type:"consum",desc:"5 日內經驗 +100%，可疊加", use:(p)=>{ addXpBuff(5); say(`📜 使用 <b>經驗加倍捲</b>：5 日加倍生效（目前層數 ${activeXpBuffs()}）。`);} }, // [NEW]
    "技能書：活力":{type:"book", skill:"vitality"},
    "技能書：專注":{type:"book", skill:"focus"},
    "技能書：火球術":{type:"book", skill:"fireball"},
    "技能書：連擊":{type:"book", skill:"flurry"},
    "技能書：破甲斬":{type:"book", skill:"armorbreak"},
  //  "技能書：猛擊":{type:"book", skill:"armorbreak"},
    "ㄅㄅㄐ之錘":{type:"consum",desc:"本次神器強化每使用1槌 +1% 成功率（可疊加，強化後歸零）。",use:(p)=>{if(!game.buffs) game.buffs={xpLayers:[],artiHammer:0};game.buffs.artiHammer = (game.buffs.artiHammer||0) + 1;
    decInv("ㄅㄅㄐ之錘",1);
    say(`🔧 你使用了 ㄅㄅㄐ之錘，神器強化成功率加成：+${game.buffs.artiHammer}%`);
  }
},
"錢袋": {
  type:"consum",
  desc:"打開可獲得隨機 100～2000 金幣。",
  use:(p)=>{
    if(!game || !game.player) return;
    const g = rnd(100,2000);           // 隨機 100~2000
    game.player.gold += g;             // 加到玩家金幣
    decInv("錢袋",1);                  // 背包扣一個錢袋
    say(`💰 你打開了 <b>錢袋</b>，從 <b>100～2000</b> G 中抽中 <b>${g}</b> G！`);
    render();
    autosave();
  }
},

  };

  const EQUIPS={
    "新手武器":{slot:"weapon", qual:"白", str:1, agi:1, int:1, spi:1},
    "新手毛衣":{slot:"armor",  qual:"白", str:1, agi:1, int:1, spi:1},
    "新手抱枕":{slot:"acc",    qual:"白", str:1, agi:1, int:1, spi:1},

    "吊墜":{slot:"weapon", weapon:"吊墜", qual:"白", atk:2, mp:10, int:1, spi:1, bindSeries:"Mage"},
    "水晶球":{slot:"weapon", weapon:"水晶球", qual:"白", atk:3, mp:12, int:2, bindSeries:"Mage"},
    "魔法書":{slot:"weapon", weapon:"魔法書", qual:"白", atk:2, mp:8, int:1, spi:1, bindSeries:"Mage"},
    "法杖":{slot:"weapon", weapon:"法杖", qual:"白", atk:3, int:2, spi:1, bindSeries:"Mage"},

    "短劍盾":{slot:"weapon", weapon:"短劍盾", qual:"白", atk:3, def:1, str:1, agi:1, bindSeries:"Warrior"},
    "長劍盾":{slot:"weapon", weapon:"長劍盾", qual:"白", atk:4, def:2, str:2, bindSeries:"Warrior"},

    "雙刀":{slot:"weapon", weapon:"雙刀", qual:"白", atk:3, str:1, agi:2, bindSeries:"Assassin"},
    "刺刀":{slot:"weapon", weapon:"刺刀", qual:"白", atk:4, str:2, agi:1, bindSeries:"Assassin"},
    "爪":{slot:"weapon", weapon:"爪", qual:"白", atk:3, agi:2, spi:1, bindSeries:"Assassin"},
    "暗器":{slot:"weapon", weapon:"暗器", qual:"白", atk:3, agi:1, int:1, spi:1, bindSeries:"Assassin"},

    "長弓":{slot:"weapon", weapon:"長弓", qual:"白", atk:3, agi:2, bindSeries:"Ranger"},
    "短弓":{slot:"weapon", weapon:"短弓", qual:"白", atk:4, agi:1, str:1, bindSeries:"Ranger"},
    "手弩":{slot:"weapon", weapon:"手弩", qual:"白", atk:3, agi:1, str:1, bindSeries:"Ranger"},
    "重弩":{slot:"weapon", weapon:"重弩", qual:"白", atk:4, str:2, def:1, bindSeries:"Ranger"},

    "盔甲":{slot:"armor", qual:"白", def:3, hp:15, str:1, bindSeries:"Warrior"},
    "披風":{slot:"acc",   qual:"白", def:1, str:1, agi:1, bindSeries:"Warrior"},
    "長袍":{slot:"armor", qual:"白", def:2, hp:12, int:1, spi:1, bindSeries:"Mage"},
    "戒指":{slot:"acc",   qual:"白", mp:12, int:1, spi:1, bindSeries:"Mage"},
    "皮甲":{slot:"armor", qual:"白", def:2, hp:12, str:1, agi:1, bindSeries:"Assassin"},
    "腰鍊":{slot:"acc",   qual:"白", def:1, agi:1, spi:1, bindSeries:"Assassin"},
    "皮衣":{slot:"armor", qual:"白", def:2, hp:10, agi:2, bindSeries:"Ranger"},
    "耳環":{slot:"acc",   qual:"白", agi:1, int:1, spi:1, bindSeries:"Ranger"},
  };

const MOUNTS={
  // 商店坐騎（保留）
  "戰馬": { atk:0,  def:0,  hp:0,  mp:0,  spd:0, desc:"穩健耐跑，僅提供移動效率，不額外增加素質" },

  // ⬇⬇⬇ Boss 專屬坐騎（對應 bossMountName(name) => `${name}坐騎`）⬇⬇⬇
  "火龍坐騎":   { atk:0, def:0,  hp:0, mp:0,  spd:0, desc:"炙熱怒焰，但不再提供屬性加成" },
  "暴雪巨靈坐騎": { atk:0,  def:0, hp:0, mp:0,  spd:0, desc:"寒霜壁障，但不再提供屬性加成" },
  "深淵之眼坐騎": { atk:0,  def:0,  hp:0, mp:0,  spd:0, desc:"暗潮凝視，但不再提供屬性加成" },
  "星墜魔像坐騎": { atk:0,  def:0, hp:0, mp:0,  spd:0, desc:"星核重鎧，但不再提供屬性加成" },
  "終末領主坐騎": { atk:0, def:0, hp:0, mp:0, spd:0, desc:"終焉權威，但不再提供屬性加成" }
};



  // 商店目錄
  const shopCatalog=[
    {name:"小治療藥水",type:"consum",price:8},
    {name:"小魔力藥水",type:"consum",price:10},
    {name:"煙霧彈",type:"consum",price:15},
    {name:"經驗加倍捲",type:"consum",price:100}, // [NEW]
    {name:"短劍盾",type:"weapon",price:24},
    {name:"長劍盾",type:"weapon",price:28},
    {name:"吊墜",type:"weapon",price:26},
    {name:"水晶球",type:"weapon",price:30},
    {name:"魔法書",type:"weapon",price:25},
    {name:"法杖",type:"weapon",price:28},
    {name:"雙刀",type:"weapon",price:24},
    {name:"刺刀",type:"weapon",price:27},
    {name:"爪",type:"weapon",price:25},
    {name:"暗器",type:"weapon",price:26},
    {name:"長弓",type:"weapon",price:25},
    {name:"短弓",type:"weapon",price:26},
    {name:"手弩",type:"weapon",price:24},
    {name:"重弩",type:"weapon",price:28},
    {name:"盔甲",type:"equip",price:22},
    {name:"長袍",type:"equip",price:22},
    {name:"皮甲",type:"equip",price:22},
    {name:"皮衣",type:"equip",price:22},
    {name:"披風",type:"equip",price:20},
    {name:"戒指",type:"equip",price:24},
    {name:"腰鍊",type:"equip",price:20},
    {name:"耳環",type:"equip",price:22},
    {name:"戰馬",type:"mount",price:10000},
  ];

   // 💰 全局金幣倍率：1 = 原本數字，4 = 四倍金幣
  const GOLD_RATE = 10;
  // ⭐ 全局經驗倍率：1 = 原本數字，2 = 兩倍經驗，0.5 = 半倍經驗
  const EXP_RATE = 1;
  
  const CLASS_REQ=[10,30,70,120];
  const zones = buildZones();
  function monsterTemplate(lvl, label = "normal") {

  // 小怪（不能無腦，需要補品）
  let hp = 60 + lvl * 25;
  let atk = 7 + lvl * 2.5;
  let def = lvl * 0.8;
  let mdef = lvl * 0.7;
  let speed = lvl * 0.25;

  // 菁英怪（容易死，不注意會翻車）
  if (label === "elite") {
    hp *= 3.0;
    atk *= 1.8;
    def *= 1.3;
  }

  // BOSS（10~15 分鐘耐久戰）
  if (label === "boss") {
    // HP 大幅提升：確保戰鬥可以 10~15 分鐘
    hp = lvl * lvl * 120 + 20000;

    // 攻擊輸出更高：逼玩家開技能＋補品
    atk *= 2.5;

    // 防禦更高：避免玩家爆擊秒殺
    def *= 2.0;
  }

  return {
    lvl,
    hp: Math.round(hp),
    maxhp: Math.round(hp),
    atk: Math.round(atk),
    def: Math.round(def),
    mdef: Math.round(mdef),
    spd: Math.round(speed),
    exp: [lvl * 12, lvl * 18],
    gold: [lvl * 1.5, lvl * 2.5],
    tag: label,
    // 基礎掉落表：所有怪物類型都至少有一個陣列可用
    drops: baseDropsForLevel(lvl, label)
  };
}

 

  function baseDropsForLevel(lvl,tag){
  const base = [
    {item:"技能書：活力",rate:0.00},//技能書掉落率
    {item:"技能書：專注",rate:0.00},
    {item:"技能書：火球術",rate:0},
    {item:"技能書：連擊",rate:0},
    {item:"技能書：破甲斬",rate:0},   // ★ 新增這行
//    {item:"技能書：猛擊",rate:0.04},
  ];

  // 🔻 基本藥水依等級分配（最高到「高級」）
  if(lvl <= 30){
    // 新手區：小藥水
    base.push(
      {item:"小治療藥水",rate:0.14},
      {item:"小魔力藥水",rate:0.12}
    );
  } else if(lvl <= 60){
    // 中期：中藥水
    base.push(
      {item:"中治療藥水",rate:0.14},
      {item:"中魔力藥水",rate:0.12}
    );
  } else if(lvl <= 90){
    // 後期：大藥水
    base.push(
      {item:"大治療藥水",rate:0.14},
      {item:"大魔力藥水",rate:0.12}
    );
  } else {
    // 高等地圖：高級藥水（最高掉到這一階）
    base.push(
      {item:"高級治療藥水",rate:0.14},
      {item:"高級魔力藥水",rate:0.12}
    );
  }

  // 任務藥水：掉落表先寫進去，實際掉不掉交給 handleDrops() 判斷有沒有任務
  base.push(
    {item:"任務藥水", rate:0.12}
  );

  // 低等區域白裝掉落（1~30 等）
  if(lvl<=30){
    base.push(
      {equip:"短劍盾",rate:0.05},
      {equip:"吊墜",rate:0.04},
      {equip:"雙刀",rate:0.04},
      {equip:"長弓",rate:0.04},
      {equip:"盔甲",rate:0.03},
      {equip:"長袍",rate:0.03},
      {equip:"皮甲",rate:0.03},
      {equip:"皮衣",rate:0.03},
      {equip:"披風",rate:0.02},
      {equip:"戒指",rate:0.02},
      {equip:"腰鍊",rate:0.02},
      {equip:"耳環",rate:0.02}
    );
  }

  return base;
}

  /* ========= 狀態 ========= */

  const game = {
    player:{
      name:"你", job:"Novice", tier:0, lvl:1, exp:0,
      baseStr:5, baseAgi:5, baseInt:5, baseSpi:5,
      str:5, agi:5, int:5, spi:5,
      freeStatPoints:0, freeSkillPoints:1, skillPointsByTier:{0:1},
      hp:0, mp:0, atk:0, def:0, maxhp:0, maxmp:0,
      gold:200, afk:false, lastTick:0,
      equip:{weapon:null,armor:null,acc:null,mount:null},
      learned:{basicSlash:1, manaSpark:0, powerFundamentals:0, agilityFundamentals:0, accuracyFundamentals:0, arcaneFundamentals:0, insight:0},   // 初始技能庫
      activeSkill:"basicSlash",
      skillQual:{},
      passiveKills:{},
      rebirths: 0   // ← 新增：已轉生次數
    },

    inv:{
      "小治療藥水":10,
      "小魔力藥水":10,
      "煙霧彈":1,
    },
    state:{ inBattle:false, enemy:null, kills:{}, zoneId:"z-01", day:1, guardMitigation:{ratio:0,turns:0}, counterReady:false, playerShield:0, wildHowl:{turns:0}, bloodUnleash:{turns:0}, warInstinctStacks:0 },
    quests:[], shop:{stock:[]},
    buffs:{ xpLayers:[] }, // 多層加倍，每層為剩餘日數
    uiFlags:{ classNotice:{} }
  };

  /* ========= 工具 ========= */
// ─────────────────────────────
// 分類標籤：武器/防具/飾品/坐騎/技能書/消耗品
// ─────────────────────────────
const SLOT_TAG = { weapon:"武器", armor:"防具", acc:"飾品", mount:"坐騎" };

function categoryTagForKey(k){
  // 裝備實體（E#...）
  if(k.startsWith("E#")){
    const inst = getEquipInstance(k);
    if(!inst) return `<span class="cat">[裝備]</span>`;
    const lab = SLOT_TAG[inst.slot] || "裝備";
    return `<span class="cat cat-${inst.slot}">[${lab}]</span>`;
  }
  // 坐騎實體（M#...）
  if(k.startsWith("M#")){
    return `<span class="cat cat-mount">[坐騎]</span>`;
  }
  // 一般物品：判斷技能書，其餘當消耗品
  const n = k || "";
  const defType = itemDefs?.[n]?.type;
  const isBook =
    defType === "book" ||
    defType === "skillbook" ||
    n.includes("技能書") ||
    n.startsWith("秘傳：");
  if(isBook) return `<span class="cat cat-book">[技能書]</span>`;
  return `<span class="cat cat-consum">[消耗品]</span>`;
}


// （可選）把「技能書：活力」這種名稱清成「活力」
function cleanBookName(n){ return n.replace(/^技能書[:：]\s*/,''); }


  
  // 可 2 合 1 的藥水鏈（治療 & 魔力）
const POTION_CHAINS = [
  ["小治療藥水","中治療藥水","大治療藥水","特級治療藥水"],
  ["小魔力藥水","中魔力藥水","大魔力藥水","特級魔力藥水"],
];
// ===== 自動用藥參數（可自行調整） =====
const AUTO_POTION = {
  hp: { threshold: 0.60, minMissing: 10, cooldownMs: 800 },  // 低於60%且至少少10HP才喝
  mp: { threshold: 0.35, minMissing: 8,  cooldownMs: 800 }   // 低於35%且至少少8MP才喝
};

// ✅ 自動治療（HP）
function autoUseHeal(){
  const p = game.player, inv = game.inv || {};
  if(!p || p.maxhp<=0) return false;

  // 滿血、缺血不足、不在冷卻 → 直接退出
  const missing = p.maxhp - p.hp;
  if(missing <= 0) return false;
  if(missing < AUTO_POTION.hp.minMissing) return false;

  const now = Date.now();
  if(p._healCD && now - p._healCD < AUTO_POTION.hp.cooldownMs) return false;

  const hpRate = p.hp / p.maxhp;
  if(hpRate >= AUTO_POTION.hp.threshold) return false;

  // 依血量挑藥：特→大→中→小
  const tryList =
    hpRate < 0.20 ? ["特級治療藥水","大治療藥水","中治療藥水","小治療藥水"] :
    hpRate < 0.40 ? ["大治療藥水","中治療藥水","小治療藥水"] :
                    ["中治療藥水","小治療藥水"];

  for(const name of tryList){
    if((inv[name]||0) > 0){
      const used = useItem(name);      // 需搭配B段的useItem回傳布林
      if(used){ p._healCD = Date.now(); return true; }
    }
  }
  return false;
}

// ✅ 自動回魔（MP）
function autoUseMana(){
  const p = game.player, inv = game.inv || {};
  if(!p || p.maxmp<=0) return false;

  const missing = p.maxmp - p.mp;
  if(missing <= 0) return false;
  if(missing < AUTO_POTION.mp.minMissing) return false;

  const now = Date.now();
  if(p._manaCD && now - p._manaCD < AUTO_POTION.mp.cooldownMs) return false;

  const mpRate = p.mp / p.maxmp;
  if(mpRate >= AUTO_POTION.mp.threshold) return false;

  const tryList =
    mpRate < 0.20 ? ["特級魔力藥水","大魔力藥水","中魔力藥水","小魔力藥水"] :
    mpRate < 0.40 ? ["大魔力藥水","中魔力藥水","小魔力藥水"] :
                    ["中魔力藥水","小魔力藥水"];

  for(const name of tryList){
    if((inv[name]||0) > 0){
      const used = useItem(name);
      if(used){ p._manaCD = Date.now(); return true; }
    }
  }
  return false;
}

  
  
// 回傳下一級藥水名稱；若不在任何鏈或已到頂，回傳 null
function nextPotionName(name){
  for(const chain of POTION_CHAINS){
    const idx = chain.indexOf(name);
    if(idx>=0) return (idx<chain.length-1) ? chain[idx+1] : null;
  }
  return null;
}

  const rnd=(n,m)=>Math.floor(Math.random()*(m-n+1))+n;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

  const LOG_MAX_KEEP = 400;      // 觸發修剪的上限
  const LOG_TRIM_TARGET = 300;   // 修剪後保留的目標行數

  function trimLog(){
    const count = log.childElementCount;
    if(count <= LOG_MAX_KEEP) return;

    const remove = Math.max(0, count - LOG_TRIM_TARGET);
    for(let i=0; i<remove; i++){
      const first = log.firstChild;
      if(!first) break;
      log.removeChild(first);
    }
  }

  function appendLog(html, {save=true} = {}){
    const p=document.createElement("p");
    p.innerHTML=html;
    log.appendChild(p);
    trimLog();
    log.scrollTop=log.scrollHeight;
    if(save) autosave();
  }

  const say=html=> appendLog(html);
/* ================2合1藥水鏈=============== */
  /* =============================== */
  /* [ADD] 全域錯誤寫入冒險日誌（排錯用） */
  /* =============================== */
  window.addEventListener('error', e=>{
    try{ appendLog(`⚠️ <b>腳本錯誤</b>：${e.message}`, {save:false}); }catch(_){}
  });

  const colorQual=(q)=> QUAL_CLASS[QUALITY_ORDER[q]||0]||"";
  const fmtQual=(q,txt)=>`<span class="${colorQual(q)}">${txt}</span>`;
  const fmtItem=(name,qual)=> qual ? fmtQual(qual,qualName(name,qual)) : name;
  const qualName=(name,qual)=> qual==="神器" ? `[神器☆${name}]` : name;
// ★ 品質文字旁顯示星數（紫／神器）
function qualWithStars(inst){
  const s = inst.stars || 0;
  const q = inst.qual;
  if(q === "紫" || q === "神器"){
    return `${fmtQual(q, q)}${s ? ` <span class="star">${s}☆</span>` : ""}`;
  }
  return fmtQual(q, q);
}

  // 裝備詞條
   // 裝備詞條
  const AFFIX_LIB=[
    // 吸血：改成「依這次傷害的 2~4%」，不會回太多，但後期也不至於廢
    {key:"lifesteal", name:"吸血",  desc:"回復已造成傷害的 2~4%",  min:2,  max:4},

    // 中毒：改成「每回合吃玩家攻擊 10~18%」，至少 3 回合
    {key:"poison",    name:"中毒",  desc:"每回合造成攻擊 10~18% 傷害（三回合）", min:10, max:18},

    // 爆擊：維持 +5% 就好，穩定但不逆天
    {key:"crit",      name:"爆擊",  desc:"暴擊率 +5%", min:5,  max:5},

    // 連擊：觸發率從 25% 降到 15%，而且只吃大約 7 成傷害
    {key:"combo",     name:"連擊",  desc:"15% 觸發 7 成傷害的追加打擊", min:15, max:15},

    // 破甲：維持敵防 -20%，當作一個穩定輸出詞條
    {key:"shred",     name:"破甲",  desc:"計算傷害時敵防 -20%", min:20, max:20},
  ];


  function autosave(){
    try{
      // 一併存入裝備／坐騎資料庫，避免重載後顯示 E# 原字串
      game._eqdb = EQUIP_DB;
      game._mddb = MOUNT_DB;
      localStorage.setItem(LKEY, JSON.stringify(game));
    }catch(e){}
  }
  function load(){
    try{
      const raw=localStorage.getItem(LKEY);
      if(raw){
        const data=JSON.parse(raw);
        Object.assign(game.player, data.player||{});
        game.inv=data.inv||game.inv;
        game.state={...game.state, ...(data.state||{})};
                // 任務：舊存檔兼容＆新格式初始化
        game.quests=data.quests||[];
        if(!Array.isArray(game.quests)) game.quests=[];
        // 如果是舊版存檔（沒有 type），或根本沒任務，就用新系統重建
        if(game.quests.length===0 || !game.quests[0].type){
          seedQuests();
        }
        game.shop=data.shop||{stock:[]};
        game.buffs=data.buffs||{xpLayers:[]};
        game.uiFlags=data.uiFlags||{classNotice:{}};
        if(!game.uiFlags.classNotice) game.uiFlags.classNotice = {};
        // 反序列化 DB
        Object.assign(EQUIP_DB, data._eqdb||{});
        Object.assign(MOUNT_DB, data._mddb||{});
        ensureNoviceSkillDefaults();
        recomputeStats(true);
      } else {
        seedQuests();
      }
    }catch(e){}
  }

function ensureNoviceSkillDefaults(){
    const p = game.player;
    if(!p.learned) p.learned = {};
    ["basicSlash","manaSpark","powerFundamentals","agilityFundamentals","accuracyFundamentals","arcaneFundamentals","insight"].forEach(id=>{
      if(typeof p.learned[id] !== "number") p.learned[id] = id==="basicSlash" ? 1 : 0;
    });
    if(!p.activeSkill || !SKILL[p.activeSkill]){
      p.activeSkill = "basicSlash";
    }

    ensurePlayerStatDefaults();
    refreshSkillPointBuckets();
  }

function ensurePlayerStatDefaults(){
    const p = game.player;

    // 舊版存檔兼容：若有舊的 attributes / attrPoints，轉入新欄位
    if(typeof p.baseStr !== "number"){
      const old = p.attributes || {};
      p.baseStr = typeof old.str === "number" ? old.str : 5;
      p.baseAgi = typeof old.agi === "number" ? old.agi : 5;
      p.baseInt = typeof old.int === "number" ? old.int : 5;
      p.baseSpi = typeof old.spi === "number" ? old.spi : 5;
    }
    if(typeof p.baseAgi !== "number") p.baseAgi = 5;
    if(typeof p.baseInt !== "number") p.baseInt = 5;
    if(typeof p.baseSpi !== "number") p.baseSpi = 5;

    if(typeof p.freeStatPoints !== "number"){
      const legacy = typeof p.attrPoints === "number" ? p.attrPoints : null;
      const lvl = p.lvl || 1;
      p.freeStatPoints = Math.max(0, legacy!==null ? legacy : (lvl-1)*5);
    }

    // 舊存檔兼容：若缺少轉職段數，依職業樹修正（避免無法點高階技能）
    const jobNode = JOB_TREE.find(j=>j.key===p.job);
    const inferredTier = jobNode ? jobNode.tier : 0;
    if(typeof p.tier !== "number" || p.tier < inferredTier){
      p.tier = inferredTier;
    }

    ["str","agi","int","spi"].forEach(k=>{
      const key = `base${k.charAt(0).toUpperCase()+k.slice(1)}`;
      if(typeof p[k] !== "number") p[k] = p[key];
    });

    if(typeof p.lvl !== "number") p.lvl = 1;
    if(typeof p.exp !== "number") p.exp = 0;
  }

  /* ========= 任務資料表 ========= */
  const QUEST_DB = [
    {
      id:"Q_KILL_01",
      type:"killAny",
      minLvl:1,
      name:"新手訓練：擊敗 20 隻怪物",
      desc:"在任何地區擊敗 20 隻怪物，熟悉戰鬥節奏。",
      req:{ killAny:20 },
      reward:{ exp:200, gold:150 }
    },
    {
      id:"Q_KILL_02",
      type:"killAny",
      minLvl:20,
      name:"熟練冒險者：擊敗 50 隻怪物",
      desc:"持續戰鬥，讓自己成為更可靠的主力。",
      req:{ killAny:50 },
      reward:{ exp:600, gold:500, item:"錢袋", itemCount:1 }
    },
    {
      id:"Q_ITEM_POTION",
      type:"submitItem",
      minLvl:10,
      name:"物資補給：交付任務藥水 5 瓶",
      desc:"任務小隊需要補給，收集 5 瓶任務藥水交付。",
      req:{ submitItems:{ "任務藥水":5 } },
      reward:{ exp:250, gold:300 }
    },
    {
      id:"Q_EQUIP_GREEN",
      type:"submitEquip",
      minLvl:15,
      name:"裝備回收：交出 3 件綠裝",
      desc:"把不用的綠裝回收，換取一些實用資源。",
      req:{ submitEquip:{ green:3 } },
      reward:{ exp:300, gold:400 }
    },
    {
      id:"Q_EQUIP_BLUE",
      type:"submitEquip",
      minLvl:30,
      name:"精良裝備整理：交出 2 件藍裝",
      desc:"整理多餘的藍裝，讓鐵匠鋪回收再利用。",
      req:{ submitEquip:{ blue:2 } },
      reward:{ exp:800, gold:800, item:"錢袋", itemCount:2 }
    }
  ];

  function seedQuests(){
    const lvl = game.player?.lvl || 1;
    game.quests = QUEST_DB.map(def=>({
      id: def.id,
      type: def.type,
      minLvl: def.minLvl || 1,
      name: def.name,
      desc: def.desc,
      req: JSON.parse(JSON.stringify(def.req || {})),
      reward: { ...(def.reward || {}) },
      state: (lvl >= (def.minLvl || 1)) ? "available" : "locked",
      progress: {}
    }));
    // 依目前等級刷新一次可接受狀態
    refreshQuestsForLevel(lvl);
  }

  /* ========= 地圖生成 ========= */
  function buildZones(){
    const out=[];
    for(let a=1;a<=200;a+=10){
      const b=Math.min(200,a+9);
      const id = "z-"+String(Math.ceil(a/10)).padStart(2,"0");
      out.push({
        id, name:`Lv${a}-${b} 區域 ${Math.ceil(a/10)}`, lvlReq:a, suggest:[a,b], danger:Math.ceil(a/10),
        type:"field", boss:false, hidden:false, pool: basicMonstersForBand(a,b)
      });
    }
    const hiddenTiers=[1,2,3,4];
    hiddenTiers.forEach((t,i)=>{
      const idH="h-"+(i+1);
      out.push({ id:idH, name:`【隱藏】暗影祕徑 T${t}`, lvlReq: CLASS_REQ[i], suggest:[CLASS_REQ[i], CLASS_REQ[i]+9], danger:8+i,
        type:"hidden", boss:false, hidden:true, pool: specialHiddenPool(CLASS_REQ[i]) });
      const idB="b-"+(i+1);
      out.push({ id:idB, name:`【Boss】階段守衛 T${t}`, lvlReq: CLASS_REQ[i], suggest:[CLASS_REQ[i], CLASS_REQ[i]+10], danger:10+i,
        type:"boss", boss:true, hidden:false, pool: bossPoolForTier(t) });
    });
    out.push({ id:"b-omega", name:"【Boss】終末領主", lvlReq:160, suggest:[180,200], danger:15, type:"boss", boss:true, hidden:false, pool: bossPoolForTier(5,true) });
    return out;
  }
  function basicMonstersForBand(a,b){
    const lv = Math.floor((a+b)/2);
    const names=["史萊姆","哥布林","巨鼠","蝙蝠群","樹精碎枝","石像鬼"];
    return names.map(n=>({ name:n, base:monsterTemplate(lv,""), isBoss:false }));
  }
  function specialHiddenPool(baseLvl){
    const names=["幽魂","秘紋寶箱怪","遺跡守衛"];
    return names.map(n=>({ name:n, base:monsterTemplate(baseLvl+5, n==="幽魂"?"dark":""), isBoss:false }));
  }
// Boss 掉落表（含神器碎片）
function bossPoolForTier(t,isFinal=false){
  const tbl=[["火龍"],["暴雪巨靈"],["深淵之眼"],["星墜魔像"],["終末領主"]];
  const name = isFinal ? "終末領主" : tbl[t-1][0];

  const baseLvl = t===1 ? 12 :
                  t===2 ? 35 :
                  t===3 ? 72 :
                  t===4 ? 125 : 190;

  const base = monsterTemplate(baseLvl,"boss");
  base.hp  = Math.round(base.hp*3.5);
  base.atk = Math.round(base.atk*1.6);
  base.def = Math.round(base.def*1.4);

  // 🐎 坐騎掉落
  base.drops.push({ mount: bossMountName(name), rate:0.01 });

  // 🧩 神器碎片（每種 Boss 一種碎片，5 片合成隨機該 Boss 神器）
  // 👉 rate = 0.05 = 5%
  base.drops.push({ artifactBoss: name, rate:0.05 });

  // 🔧 ㄅㄅㄐ之錘：Boss 額外 10% 掉落（搭配全地圖 1% 稀有）
  base.drops.push({ item:"ㄅㄅㄐ之錘", rate:0.10 });

  return [{ name, base, isBoss:true }];
}

function bossMountName(name){ return `${name}坐騎`; }
// bossArtifactName 目前不用了，保留也沒關係
//function bossArtifactName(name){ return `${name}之核`; }


/* ========= 角色計算 ========= */
// === 新屬性系統：以 STR/AGI/INT/SPI 驅動 ===

function attributesToStats(attr={}){
  const str = Math.max(0, attr.str || 0);
  const agi = Math.max(0, attr.agi || 0);
  const intl = Math.max(0, attr.int || 0);
  const spi = Math.max(0, attr.spi || 0);

  return {
    // 4 大屬性皆能帶來一定的防禦成長，讓坦度隨著養成自然提升
    def:  str * 0.5 + agi * 0.35 + intl * 0.25 + spi * 0.25,
    physCritRate: agi * 0.3,
    physCritDmg:  agi * 0.005,
    magicCritRate: spi * 0.3,
    magicCritDmg:  spi * 0.005,
    haste: agi * 0.003,
    manaRegen: spi * 0.6,
    skillCostReduce: Math.min(0.40, intl * 0.003),
    magicAtk: intl * 1.5 + str * 0.3
  };
}

const ATTR_META = {
  str:{ label:"STR 力量", desc:"物理攻擊／生命" },
  agi:{ label:"AGI 敏捷", desc:"物理攻擊／少量生命" },
  int:{ label:"INT 智力", desc:"魔力／魔傷" },
  spi:{ label:"SPI 精神", desc:"魔爆／回魔" }
};

function tierMultiplier(tier){ return 1 + 0.005 * (tier||0); }

function warInstinctStackCap(){
  const lv = skillLevel("WarDrivenInstinct",0);
  if(lv<=0) return 0;
  return [5,8,12,16,20][lv-1] || 0;
}
function gainWarInstinctStack(n=1){
  const cap = warInstinctStackCap();
  if(cap<=0) return;
  game.state.warInstinctStacks = Math.min(cap, (game.state.warInstinctStacks||0) + n);
  recalcPlayerStats();
}
function resetWarInstinctStacks(){
  game.state.warInstinctStacks = 0;
  recalcPlayerStats();
}
function activeWildHowl(){
  const b = game.state?.wildHowl;
  if(b && b.turns>0) return b;
  return null;
}
function activeBloodUnleash(){
  const b = game.state?.bloodUnleash;
  if(b && b.turns>0) return b;
  return null;
}
function consumeBloodUnleashSkillBoost(){
  const b = activeBloodUnleash();
  if(!b || b.skillConsumed) return 1;
  b.skillConsumed = true;
  return b.skillBoost || 1;
}
function berserkerActionSpeedBonus(){
  let bonus = 0;
  const howl = activeWildHowl();
  if(howl) bonus += howl.actionSpeed || 0;
  const unleash = activeBloodUnleash();
  if(unleash) bonus += unleash.actionSpeed || 0;
  return bonus;
}
function berserkerDamageTakenBonus(){
  let ratio = 0;
  const howl = activeWildHowl();
  if(howl) ratio += howl.dmgTaken || 0;
  const unleash = activeBloodUnleash();
  if(unleash) ratio += unleash.dmgTaken || 0;
  return ratio;
}
function berserkerAtkBuffMultiplier(){
  const unleash = activeBloodUnleash();
  if(unleash) return 1 + (unleash.atkBoost || 0);
  return 1;
}

// 被動技能（白板層）
function passiveFromSkills(p){
  const add={atk:0,def:0,hp:0,mp:0};
  const mul={atk:0,def:0,hp:0,mp:0};
  const misc={critRate:0, defPierce:0, insight:0, actionSpeed:0};

  const powerLv = skillLevel("powerFundamentals",0);
  add.atk += powerLv;

  const agiLv = skillLevel("agilityFundamentals",0);
  misc.critRate += agiLv * 2;

  const accLv = skillLevel("accuracyFundamentals",0);
  misc.defPierce += accLv * 2;

  const arcLv = skillLevel("arcaneFundamentals",0);
  add.mp += arcLv * 3;

  const insightLv = skillLevel("insight",0);
  misc.insight = insightLv;
  misc.actionSpeed = insightLv * 0.02;

  const frenzyLv = skillLevel("BloodFrenzyBody",0);
  if(frenzyLv>0){
    const hpPct = (p.hp || 0) / Math.max(1, p.maxhp || 1);
    let atkMul = 0, critBonus = 0;
    if(hpPct < 0.3){
      atkMul = 0.20 + 0.05*(frenzyLv-1);
      critBonus = 10 + 3*(frenzyLv-1);
    }else if(hpPct < 0.5){
      atkMul = 0.12 + 0.03*(frenzyLv-1);
      critBonus = 6 + 2*(frenzyLv-1);
    }else if(hpPct < 0.7){
      atkMul = 0.06 + 0.02*(frenzyLv-1);
      critBonus = 3 + 1*(frenzyLv-1);
    }
    mul.atk += atkMul;
    misc.critRate += critBonus;
  }

  const instinctLv = skillLevel("WarDrivenInstinct",0);
  if(instinctLv>0){
    const stacks = Math.min(game.state?.warInstinctStacks || 0, warInstinctStackCap());
    const atkPer = [0.02,0.03,0.04,0.05,0.06][instinctLv-1];
    const spdPer = [0.01,0.015,0.02,0.025,0.03][instinctLv-1];
    mul.atk += stacks * atkPer;
    misc.actionSpeed += stacks * spdPer;
  }

  return { add, mul, misc };
}

  function getEquipTotalStats(){
  const p = game.player || {};
  const totals = { atk:0, def:0, hp:0, mp:0, str:0, agi:0, int:0, spi:0 };
  ["weapon","armor","acc"].forEach(slot=>{
    const n = p.equip?.[slot];
    if(!n) return;
    const inst = getEquipInstance(n);
    if(inst){
      totals.atk += inst.atk || 0;
      totals.def += inst.def || 0;
      totals.hp  += inst.hp  || 0;
      totals.mp  += inst.mp  || 0;
      totals.str += inst.str || 0;
      totals.agi += inst.agi || 0;
      totals.int += inst.int || 0;
      totals.spi += inst.spi || 0;
    }
  });
  const mid = p.equip?.mount;
  if(mid){
    const m = getMountInstance(mid);
    if(m){
      totals.atk += m.atk || 0;
      totals.def += m.def || 0;
      totals.hp  += m.hp  || 0;
      totals.mp  += m.mp  || 0;
      totals.str += m.str || 0;
      totals.agi += m.agi || 0;
      totals.int += m.int || 0;
      totals.spi += m.spi || 0;
    }
  }
  return totals;
}

function recalcPlayerStats(){
  const p = game.player;
  ensurePlayerStatDefaults();

  const eq = getEquipTotalStats();

  p.str = p.baseStr + (eq.str || 0);
  p.agi = p.baseAgi + (eq.agi || 0);
  p.int = p.baseInt + (eq.int || 0);
  p.spi = p.baseSpi + (eq.spi || 0);

  const attrStats = attributesToStats({ str:p.str, agi:p.agi, int:p.int, spi:p.spi });

  let maxhp = 100 + p.str * 8 + p.agi * 4;
  let maxmp = 30 + p.int * 5 + p.str * 1 + p.agi * 1;
  let atk   = p.str * 2 + p.agi * 1;
  let def   = p.str * 1 + p.agi * 0.5 + (p.lvl||1) * 0.2 + (attrStats.def || 0);
  let magicAtk = attrStats.magicAtk || atk;

  maxhp += eq.hp || 0;
  maxmp += eq.mp || 0;
  atk   += eq.atk || 0;
  def   += eq.def || 0;
  magicAtk += eq.atk || 0;

  const mulTier = tierMultiplier(p.tier||0);
  maxhp = Math.floor(maxhp * mulTier);
  maxmp = Math.floor(maxmp * mulTier);
  atk   = Math.floor(atk   * mulTier);
  def   = Math.floor(def   * mulTier);
  magicAtk = Math.floor(magicAtk * mulTier);

    // ⭐ 已取消轉職數值加成，舊存檔的 jobBonus 也不再套用
  /*
  if (game.player.jobBonus){
    const jbMul = game.player.jobBonus;
    maxhp  = Math.floor(maxhp  * (1 + (jbMul.hp  || 0)));
    maxmp  = Math.floor(maxmp  * (1 + (jbMul.mp  || 0)));
    atk    = Math.floor(atk    * (1 + (jbMul.atk || 0)));
    def    = Math.floor(def    * (1 + (jbMul.def || 0)));
    magicAtk = Math.floor(magicAtk * (1 + (jbMul.atk || 0)));
  }
*/
  const pas = passiveFromSkills(p);
  const apply = (base,key)=> Math.floor( (base + (pas.add?.[key]||0)) * (1 + (pas.mul?.[key]||0)) );
  maxhp = apply(maxhp, "hp");
  maxmp = apply(maxmp, "mp");
  atk   = apply(atk, "atk");
  def   = apply(def, "def");
  magicAtk = apply(magicAtk, "atk");

  p.bonusCritRate = pas.misc?.critRate || 0;
  p.defPierce = pas.misc?.defPierce || 0;
  p.insightLv = pas.misc?.insight || 0;
  p.actionSpeedBonus = (pas.misc?.actionSpeed || 0) + (attrStats.haste || 0);

  p.maxhp = Math.max(1, Math.floor(maxhp));
  p.maxmp = Math.max(0, Math.floor(maxmp));
  p.atk   = Math.max(1, Math.floor(atk));
  p.def   = Math.max(0, Math.floor(def));
  p.magicAtk = Math.max(1, Math.floor(magicAtk));

  // 若血量／魔力未初始化或為 0，開場時自動補滿（避免新檔沒有血魔的問題）
  if(typeof p.hp !== "number" || p.hp <= 0) p.hp = p.maxhp;
  if(typeof p.mp !== "number" || p.mp <= 0) p.mp = p.maxmp;
  p.hp = Math.min(p.hp, p.maxhp);
  p.mp = Math.min(p.mp, p.maxmp);

  p.physCritRate = 5 + (attrStats.physCritRate || 0) + (p.bonusCritRate || 0);
  p.magicCritRate = 5 + (attrStats.magicCritRate || 0);
  p.physCritDmg = 1.8 + (attrStats.physCritDmg || 0);
  p.magicCritDmg = 1.8 + (attrStats.magicCritDmg || 0);
  p.manaRegen = attrStats.manaRegen || 0;
  p.skillCostReduce = attrStats.skillCostReduce || 0;

  p.spdFromMount = 0;
}

// 舊接口：確保其他流程仍可呼叫
function recomputeStats(){
  recalcPlayerStats();
}



  function expNeedForLevel(lvl){
    let base = Math.floor(20 + Math.pow(lvl, 1.4)*3);
    const tier = game.player.tier || 0;
    base = base * Math.max(1, Math.pow(2, tier));
    return base;
  }

  function renderCritPanel(p){
    const physRate = (p.physCritRate || 0).toFixed(1);
    const magicRate = (p.magicCritRate || 0).toFixed(1);
    const physDmg = Math.round((p.physCritDmg || 1) * 100);
    const magicDmg = Math.round((p.magicCritDmg || 1) * 100);
    const manaRegen = Math.floor(p.manaRegen || 0);
    const costReduce = Math.round((p.skillCostReduce || 0) * 100);
    return `<div class="stat span2">物爆：${physRate}%｜爆傷：${physDmg}%<br>魔爆：${magicRate}%｜爆傷：${magicDmg}%<br>魔力恢復：+${manaRegen} MP/行動｜技能耗魔：-${costReduce}%</div>`;
  }

  function renderAttributePanel(p){
    const attrs = { str:p.baseStr||0, agi:p.baseAgi||0, int:p.baseInt||0, spi:p.baseSpi||0 };
    const remain = p.freeStatPoints || 0;
    const rows = ["str","agi","int","spi"].map(k=>{
      const meta = ATTR_META[k];
      const val = attrs[k] || 0;
      const dis1 = remain<=0 ? "disabled" : "";
      const dis5 = remain<5 ? "disabled" : "";
      return `<div class="attr-row"><div class="attr-meta"><div class="attr-name">${meta.label}</div><div class="hint">${meta.desc}</div></div><div class="attr-controls"><span class="attr-value">${val}</span><div class="attr-buttons"><button class="btn small attr-btn" data-attr="${k}" data-add="1" ${dis1}>+1</button><button class="btn small attr-btn" data-attr="${k}" data-add="5" ${dis5}>+5</button></div></div></div>`;
    }).join("");
    return `<div class="stat span2 attr-panel"><div class="attr-head">可用屬性點：${remain}</div><div class="attr-grid">${rows}</div></div>`;
  }

  function bindAttributeButtons(){
    if(!statsBox) return;
    statsBox.querySelectorAll('.attr-btn').forEach(btn=>{
      btn.onclick=()=>{
        const attr = btn.dataset.attr;
        const add = Number(btn.dataset.add||1);
        addStat(attr, add);
      };
    });
  }

  function addStat(statName, amount=1){
    if(!ATTR_META[statName]) return;
    const p = game.player;
    ensurePlayerStatDefaults();
    const spend = Math.min(Math.max(1, amount), p.freeStatPoints || 0);
    if(spend <= 0) return;

    if(statName === "str") p.baseStr += spend;
    if(statName === "agi") p.baseAgi += spend;
    if(statName === "int") p.baseInt += spend;
    if(statName === "spi") p.baseSpi += spend;

    p.freeStatPoints = Math.max(0, (p.freeStatPoints||0) - spend);
    say(`📈 ${ATTR_META[statName].label} +${spend}（剩餘 ${p.freeStatPoints} 點）`);
    recalcPlayerStats();
    render();
    autosave();
  }

  /* ========= Render ========= */
  function renderBattleStatus(){
    const ui = battleStatusUI;
    if(!ui.ally.lvl || !ui.enemy.name) return;

    const p = game.player || {};
    const e = game.state.enemy;
    const pct = (v, max)=>{
      if(!max || max<=0) return { text:"—", pct:0 };
      const rate = Math.max(0, Math.min(100, Math.round((v / max) * 100)));
      return { text:`${rate}%`, pct:rate };
    };
    const fmtVal = v => (v || v===0) ? Math.round(v) : "—";
    const valTxt = (v, max)=>{
      if(!max || max<=0) return "—";
      const safeMax = Math.max(0, Math.round(max));
      const safeVal = Math.max(0, Math.round(v||0));
      return `${safeVal}/${safeMax}`;
    };
    const fmtLvl = lvl=> lvl ? `Lv.${lvl}` : "—";
    const updateSide = (side, data)=>{
      const hpInfo = pct(data.hp, data.maxhp);
      side.hpPct.textContent = hpInfo.text;
      if(side.hpBar) side.hpBar.style.width = `${hpInfo.pct}%`;
      side.hpVal.textContent = valTxt(data.hp, data.maxhp);

      const mpInfo = pct(data.mp, data.maxmp);
      side.mpPct.textContent = mpInfo.text;
      if(side.mpBar) side.mpBar.style.width = `${mpInfo.pct}%`;
      side.mpVal.textContent = valTxt(data.mp, data.maxmp);
    };

    ui.ally.lvl.textContent = fmtLvl(p.lvl);
    ui.ally.atk.textContent = fmtVal(p.atk);
    ui.ally.magic.textContent = fmtVal(p.magicAtk || p.atk);
    updateSide(ui.ally, { hp:p.hp, maxhp:p.maxhp, mp:p.mp, maxmp:p.maxmp });

    ui.enemy.name.textContent = e ? e.name : "—";
    ui.enemy.lvl.textContent = e ? fmtLvl(e.lvl) : "—";
    ui.enemy.atk.textContent  = e ? fmtVal(e.atk) : "—";   // 🆕 攻擊
    ui.enemy.def.textContent  = e ? fmtVal(e.def) : "—";   // 🆕 防禦
    if(e){
      updateSide(ui.enemy, { hp:e.hp, maxhp:e.maxhp, mp:e.mp, maxmp:e.maxmp });
    }else{
      updateSide(ui.enemy, { hp:0, maxhp:0, mp:0, maxmp:0 });
    }
  }

  function render(){
    refreshSkillPointBuckets();
    const p=game.player, z=currentZone();
    const hpPct = Math.round((p.hp / p.maxhp) * 100);
    const mpPct = Math.round((p.mp / p.maxmp) * 100);
    $("#shopGold").textContent=p.gold;
    $("#zoneName").textContent = `${z.name}`;
    $("#activeSkillName").textContent = skillNameWithLv(p.activeSkill);
    renderBattleStatus();
    const critPanel = renderCritPanel(p);
    const attrPanel = renderAttributePanel(p);
    statsBox.innerHTML=`
    <div class="stat hp">HP：${p.hp} / ${p.maxhp} <span class="pct ${hpPct<=35?'low':hpPct<=60?'mid':''}">（${hpPct}%）</span></div>
    <div class="stat mp">MP：${p.mp} / ${p.maxmp} <span class="pct ${mpPct<=25?'low':mpPct<=60?'mid':''}">（${mpPct}%）</span></div>
      <div class="stat atk">攻擊：${p.atk}｜魔傷：${p.magicAtk||p.atk}</div>
      <div class="stat def">防禦：${p.def}</div>
      <div class="stat lvl">等級：${p.lvl}（EXP ${p.exp}/${expNeedForLevel(p.lvl)}）</div>
      <div class="stat">技能點：${totalFreeSkillPoints()}｜屬性點：${p.freeStatPoints||0}</div>
      ${critPanel}
      ${attrPanel}
      <div class="stat gold">金幣：${p.gold}｜職業：${jobName(p.job)}（${p.tier}轉）｜轉生：${p.rebirths||0} 次｜日數：${game.state.day}｜經驗加倍層數：${activeXpBuffs()}</div>
    `;
    bindAttributeButtons();
    // 背包（快速預覽）
    if(invBox){
      const keys = Object.keys(game.inv).filter(k => (game.inv[k]||0) > 0);

      if(keys.length === 0){
        invBox.innerHTML = `<span class="pill muted">（空）</span>`;
      }else{
        invBox.innerHTML = "";

        // 先把背包內容轉成「含類型資訊」的陣列，準備排序
        const entries = keys.map(name=>{
          const meta = invMeta(name);
          let typeOrder =
            meta.type === "consum" ? 0 :   // 消耗品
            meta.type === "book"  ? 1 :   // 技能書
            meta.type === "equip" ? 2 :   // 裝備
            meta.type === "mount" ? 3 :   // 坐騎
                                      4;  // 其他
          return { name, meta, typeOrder };
        }).sort((a,b)=>{
          // 先比類型優先順序
          if(a.typeOrder !== b.typeOrder) return a.typeOrder - b.typeOrder;
          // 同類型再比名稱（你之後想改成照品質也可以調這裡）
          return a.name.localeCompare(b.name, "zh-Hant");
        });

        // 只顯示前 12 個（避免太擠）
        entries.slice(0,12).forEach(({name, meta})=>{
          const pill = document.createElement("button");
          pill.type = "button";
          pill.className = "pill";

          // 顯示「分類 + 名稱 + 數量」
          pill.innerHTML = `${displayInvName(name)} × ${game.inv[name]}`;

          if(meta.type === "consum"){
            // 消耗品：可以直接點擊使用
            pill.classList.add("clickable");
            pill.onclick = ()=>{
              useItem(name);
            };
          }else{
            // 其他（裝備 / 坐騎 / 雜物）：點了就打開正式背包
            pill.onclick = ()=>{
              openInventory();
            };
          }

          invBox.appendChild(pill);
        });
      }
    }


    $("#runBtn").disabled=!game.state.inBattle;
    renderEnemy(); renderEquipSlots();
  }
  function renderEquipSlots(){
  const show = (slot) => {
    const id = game.player.equip[slot];
    const el = $("#equip-"+slot);
    const btn = document.querySelector(`[data-unequip="${slot}"]`);
    if(btn){ btn.disabled = !id; }
    if(id){
      if(slot === "mount"){
        el.innerHTML = displayInvName(id);     // 坐騎維持純文字
      }else{
        el.innerHTML = displayEquipName(id);     // 其他裝備吃顏色（不顯示詞條）
      }
    }else{
      el.textContent = (slot === "mount") ? "（無）" : "（空）";
    }
  };
  show("weapon"); show("armor"); show("acc"); show("mount");
}

function renderEnemy(){
    const e=game.state.enemy;
    if(!e){ enemyUI.name.textContent="—"; enemyUI.lvl.textContent="—"; enemyUI.atk.textContent="—"; enemyUI.def.textContent="—";
      enemyUI.hpTxt.textContent="0/0"; enemyUI.mpTxt.textContent="0/0"; enemyUI.hpBar.style.width="0%"; enemyUI.mpBar.style.width="0%"; return; }
    enemyUI.name.textContent=e.name; enemyUI.lvl.textContent=e.lvl; enemyUI.atk.textContent=e.atk; enemyUI.def.textContent=e.def;
    enemyUI.hpTxt.textContent=`${e.hp}/${e.maxhp}`; enemyUI.mpTxt.textContent=`${e.mp}/${e.maxmp}`;
    enemyUI.hpBar.style.width=`${Math.max(0,Math.round(e.hp/e.maxhp*100))}%`;
    enemyUI.mpBar.style.width=`${Math.max(0,Math.round(e.mp/e.maxmp*100))}%`;
  }
  function displayInvName(k){
  // 裝備（E#…）
  if(k.startsWith("E#")){
    const inst = getEquipInstance(k);
    if(!inst) return k;
    const tag = categoryTagForKey(k);
    const nameHtml = fmtItem(inst.name, inst.qual);
    const starHtml = (inst.qual==="紫" || inst.qual==="神器") && (inst.stars>0)
      ? ` <span class="star">${inst.stars}☆</span>` : "";
    // 背包清單：分類標籤 + 名稱 + +N + 星數 + 詞條
    return `${tag} ${nameHtml}${inst.plus ? ` +${inst.plus}` : ""}${starHtml}${affixShort(inst)}`;
  }

    // 坐騎（M#…）
  if(k.startsWith("M#")){
    const tag = categoryTagForKey(k);

    // 先從目前記憶體找，如果沒有就試著從存檔還原
    let m = getMountInstance(k);
    if(!m){
      m = tryRestoreMountFromSave(k);
    }

    return m ? `${tag} ${m.name}` : `${tag} ${k}`;
  }


  // 其他道具（技能書 / 消耗品）
  const tag = categoryTagForKey(k);
  const isBook = (itemDefs?.[k]?.type === "skillbook") || k.includes("技能書");
  return isBook ? `${tag} ${cleanBookName(k)}` : `${tag} ${k}`;
}
  const STAT_LABELS = { str:"STR", agi:"AGI", int:"INT", spi:"SPI", atk:"ATK", def:"DEF", hp:"HP", mp:"MP" };
  const STAT_ORDER = ["str","agi","int","spi","atk","def","hp","mp"];

  function formatStatSummary(obj={}, {includeZero=false, delimiter=" ", skipEmptyText="無素質"}={}){
    const parts = STAT_ORDER.map(k=>{
      const v = obj[k];
      if(!includeZero && (v === undefined || v === null || v === 0)) return null;
      return `${STAT_LABELS[k]} ${v ?? 0}`;
    }).filter(Boolean);
    if(obj.slot === "weapon" && obj.weapon){
      const spd = WEAPON_SPEED[obj.weapon];
      if(spd) parts.push(`速度 ${spd}`);
    }
    return parts.length ? parts.join(delimiter) : skipEmptyText;
  }

  function formatStatDiff(newStats={}, oldStats={}){
    const parts = STAT_ORDER.map(k=>{
      const d = (newStats[k]||0) - (oldStats[k]||0);
      if(d > 0) return `<span class="diff-up">${STAT_LABELS[k]} +${d} 🟥</span>`;
      if(d < 0) return `<span class="diff-down">${STAT_LABELS[k]} ${d} 🟩</span>`;
      return `<span class="diff-zero">${STAT_LABELS[k]} 0</span>`;
    });

    const critDiffHtml = formatCritDiff(newStats, oldStats);
    return [parts.join("／"), critDiffHtml].filter(Boolean).join("｜");
  }

  function formatCritDiff(newStats={}, oldStats={}){
    const pickAttrs = stats=>({
      str: stats.str || 0,
      agi: stats.agi || 0,
      int: stats.int || 0,
      spi: stats.spi || 0
    });

    const derive = stats => attributesToStats(pickAttrs(stats));
    const a = derive(newStats);
    const b = derive(oldStats);

    const physRateDiff = (a.physCritRate || 0) - (b.physCritRate || 0);
    const magicRateDiff = (a.magicCritRate || 0) - (b.magicCritRate || 0);
    const physDmgDiff = ((a.physCritDmg || 0) - (b.physCritDmg || 0)) * 100;
    const magicDmgDiff = ((a.magicCritDmg || 0) - (b.magicCritDmg || 0)) * 100;

    const fmt = (label, diff)=>{
      const rounded = Math.round(diff * 10) / 10;
      if(Math.abs(rounded) < 0.1) return `<span class="diff-zero">${label} 0%</span>`;
      const cls = rounded > 0 ? "diff-up" : "diff-down";
      const icon = rounded > 0 ? "🟥" : "🟩";
      const sign = rounded > 0 ? `+${rounded}` : `${rounded}`;
      return `<span class="${cls}">${label} ${sign}% ${icon}</span>`;
    };

    return [
      fmt("物爆率", physRateDiff),
      fmt("魔爆率", magicRateDiff),
      fmt("物爆傷", physDmgDiff),
      fmt("魔爆傷", magicDmgDiff)
    ].join("／");
  }


function displayEquipName(id){
  const inst = getEquipInstance(id);
  if(!inst) return id;
  // 🧩 這裡用 fmtItem + inst.qual，就會吃到你的品質顏色
  const nameHtml = fmtItem(inst.name, inst.qual); // 依品質上色
  const starHtml = (inst.qual==="紫" || inst.qual==="神器") && (inst.stars>0)
    ? ` <span class="star">${inst.stars}☆</span>` : "";
  const tag = categoryTagForKey(id); // [武器] / [防具] / [飾品] / [坐騎]
  // ➜ 「[武器] 短劍盾 +5 ☆」整串會帶顏色
  return `${tag} ${nameHtml}${inst.plus ? ` +${inst.plus}` : ""}${starHtml}`;
}

function weaponSeriesKey(name){
  for(const [series, names] of Object.entries(CLASS_WEAPONS)){
    if(names.includes(name)) return series;
  }
  return null;
}

function equipRestrictionText(inst){
  if(!inst) return "職業：—";

  if(inst.slot === "weapon"){
    const series = weaponSeriesKey(inst.weapon || inst.name);
    return series ? `職業：${jobName(series)}系` : "職業：不限";
  }

  const series = inferEquipSeries(inst);
  if(series) return `職業：${jobName(series)}系`;
  return "職業：不限";
}




  function affixShort(inst){
    if(!inst||!inst.affix||!inst.affix.length) return "";
    const tags = inst.affix.map(a=>{
      const def=AFFIX_LIB.find(x=>x.key===a.key);
      if(!def) return "";
      if(a.key==="crit") return "｜爆擊+5%";
      if(a.key==="combo") return "｜連擊25%";
      if(a.key==="shred") return "｜破甲20%";
      if(a.key==="lifesteal") return `｜吸血${a.val}`;
      if(a.key==="poison") return `｜毒${a.val}`;
      return "";
    }).join("");
    return tags;
  }
  function skillNameWithLv(id){
    const lv = skillLevel(id, 0);
    const qual = (game.player.skillQual||{})[id]||0;
    const tag = qual>=1? `（${QUALS[qual]}）`:"";
    const max = skillMaxLv(id);
    return `${SKILL[id]?.name||"—"} Lv.${lv}/${max}${tag}`;
  }
  function jobName(key){ const j=JOB_TREE.find(j=>j.key===key); return j?j.name:key; }
  function rootJobOf(jobKey){
    const cur = JOB_TREE.find(j=>j.key===jobKey);
    if(!cur) return null;
    if(!cur.parent || cur.parent === "Novice") return cur.key;
    return rootJobOf(cur.parent);
  }

  function clampValue(v, min, max){ return Math.min(max, Math.max(min, v)); }

  function combatPowerScore(stats={}){
    const atk = Math.max(0, stats.atk || 0);
    const def = Math.max(0, stats.def || 0);
    const hp  = Math.max(0, stats.hp  || 0);
    const mp  = Math.max(0, stats.mp  || 0);

    const durability = Math.sqrt(hp) * 10 + Math.sqrt(mp) * 4;
    return atk * 1.5 + def * 1.2 + durability;
  }

  function adaptiveDifficultyScale(playerPower, enemyPower){
    if(enemyPower <= 0) return 1;
    const ratio = playerPower / enemyPower;
    if(ratio < 1){
      const eased = 0.45 + 0.55 * Math.sqrt(Math.max(ratio, 0));
      return clampValue(eased, 0.45, 1);
    }
    const softened = 1 + (ratio - 1) * 0.35;
    return clampValue(softened, 0.9, 1.5);
  }

  /* ========= 地圖 / 戰鬥 ========= */
  function currentZone(){ return zones.find(z=>z.id===game.state.zoneId) || zones[0]; }
  function openMap(){
    const p=game.player;
    const box=$("#zoneList"); box.innerHTML="";
    zones.forEach(z=>{
      const locked = p.lvl < z.lvlReq;
      const row=document.createElement("div"); row.className="row";
      const sug = `建議 ${z.suggest[0]}-${z.suggest[1]} 等`;
      row.innerHTML = `<div><b>${z.name}</b> <span class="tag">Lv≥${z.lvlReq}${z.hidden?"｜隱藏":""}｜${sug}${z.boss?"｜Boss獨立":""}</span></div>`;
      const go=btn( locked?"未開放" : (game.state.zoneId===z.id?"目前地區":"前往"), ()=>{
        if(locked) return;
        game.state.zoneId=z.id; say(`🧭 你移動到 <b>${z.name}</b>。`); render(); mapDlg.close();
      });
      if(locked) go.disabled=true; row.appendChild(go); box.appendChild(row);
    });
    mapDlg.showModal();
  }

  function randomEnemy(){
  const z=currentZone();
  const bandMid = Math.floor((z.suggest[0]+z.suggest[1])/2);
  const basePick = z.pool[rnd(0,z.pool.length-1)];
  const base = JSON.parse(JSON.stringify(basePick.base));
  const dayScale=1+(Math.min(60,game.state.day)-1)*0.01;
  const lvl=rnd(z.suggest[0],z.suggest[1]);
  const sc = 1 + (lvl - bandMid)*0.02;
  const p=game.player;
  const tierScale = 1 + p.tier*0.15 + Math.max(0, (p.lvl - bandMid))*0.01;
  const playerPower = combatPowerScore({ atk:p.atk, def:p.def, hp:p.maxhp, mp:p.maxmp });
  const enemyPower = combatPowerScore(base);
  const dynScale = adaptiveDifficultyScale(playerPower, enemyPower);
  ["hp","mp","atk","def"].forEach(k=> base[k]=Math.max(1, Math.round(base[k]*dayScale*sc*tierScale*dynScale)));

  if (basePick.isBoss) {
    const playerMaxHp = Math.max(1, game.player?.maxhp || 0);
    base.hp = Math.max(1, Math.round(playerMaxHp * 50));
  }

  const e = {
    name: basePick.name,
    lvl,
    maxhp: base.hp, hp: base.hp,
    maxmp: base.mp, mp: base.mp,
    atk: base.atk, def: base.def,
    gold: Math.round(rnd(...base.gold)),
    exp:  Math.round(rnd(...base.exp)),
    drops: base.drops,            // ⬅️ 這一行是關鍵：把掉落表帶進敵人物件
    isBoss: !!basePick.isBoss,
    tag: base.tag || "",
    dot: 0, dotTurns: 0,
    defDown: 0, defDownTurns: 0,   // 防禦 Debuff 用
    atkDown:0, atkDownTurns:0,
    hitDown:0, hitDownTurns:0
  };

  return e;
}


  function startBattle(){
    if(game.state.inBattle){ say("你還在戰鬥中！"); return; }
    const z=currentZone();
    const e=randomEnemy(); game.state.enemy=e; game.state.inBattle=true;
    game.state.guardMitigation={ratio:0,turns:0};
    game.state.counterReady=false;
    game.state.playerShield=0;
    game.state.wildHowl={turns:0};
    game.state.bloodUnleash={turns:0};
    resetWarInstinctStacks();
    say(`⚔️ 在「${z.name}」遭遇 <b>${e.name}</b>（Lv.${e.lvl}｜HP ${e.hp}｜攻 ${e.atk}｜防 ${e.def}）。`);
    const insLv = game.player.insightLv || 0;
    if(insLv>0 && Array.isArray(e.drops)){
      const peek = e.drops.slice(0, Math.min(e.drops.length, 2 + insLv));
      const names = [...new Set(peek.map(d=> d.item || d.equip || d.mount || d.skill || ""))].filter(Boolean);
      if(names.length>0){
        say(`👀 洞察 Lv.${insLv}：可能掉落 <b>${names.join("、")}</b>。`);
      }
    }
    render();
  }
  function playerAttack(){
    if(!game.state.inBattle){ say("現在沒有在戰鬥。"); return; }
    recalcPlayerStats();
    const p=game.player, e=game.state.enemy;
    const effDef=effectiveEnemyDef(e,p);
    let out=Math.max(1, rnd(p.atk-2,p.atk+2)-effDef);
    out=critMaybe(p,out,"physical");
    out=applySpeedBonus(p,out);
    out = Math.floor(out * berserkerAtkBuffMultiplier());
    e.hp=clamp(e.hp-out,0,e.maxhp); affixOnHit(p,e,out);
    say(`你進行普通攻擊，造成 <span class="hp">-${out}</span>。`);
    recoverManaOnAction(p);
    if(e.hp<=0) return endBattle(true);
    // 中毒DOT在回合終結時生效
    enemyTurn();
  }
 function useActiveSkill(){
  // 不在戰鬥中 → 不算施放
  if(!game.state.inBattle){
    say("不在戰鬥中。");
    return false;
  }

  const id = game.player.activeSkill;
  const sk = SKILL[id];
  if(!sk || typeof sk.use !== "function"){
    say("沒有可施放的主動技能。");
    return false;
  }

  recalcPlayerStats();

  const lv = skillLevel(id, 0);
  if(lv <= 0){
    say("尚未習得此技能。");
    return false;
  }
  const ok = sk.use(game.player, game.state.enemy, lv);
  render();

  // 技能本身回傳 false（多半是 MP 不足）→ 視為施放失敗
  if(!ok) return false;

  if(game.state.enemy.hp <= 0){
    endBattle(true);
    return true;
  }

  enemyTurn();
  return true;
}

  function tickPlayerBuffs(){
    const p=game.player;
    const state = game.state;
    if(state?.wildHowl?.turns>0){
      state.wildHowl.turns--;
      if(state.wildHowl.turns<=0){
        state.wildHowl={turns:0};
        say(`🐺 <b>野性之吼</b>的效果消散。`);
      }
    }
    if(state?.bloodUnleash?.turns>0){
      state.bloodUnleash.turns--;
      if(state.bloodUnleash.turns<=0){
        const penaltyRate = state.bloodUnleash.hpPenalty || 0;
        const hpLoss = Math.max(1, Math.floor(p.maxhp * penaltyRate));
        p.hp = Math.max(1, p.hp - hpLoss);
        state.bloodUnleash={turns:0};
        say(`💔 <b>怒血解放</b>反噬，損失 <b>${hpLoss}</b> HP。`);
        recalcPlayerStats();
      }
    }
  }

  function enemyTurn(){
    const p=game.player, e=game.state.enemy;
      // ✅ 沒敵人就結束（避免 e.dot 取值報錯）
  if(!e){
    game.state.inBattle = false;
    return;
  }

    tickPlayerBuffs();

    // 持續傷害（毒 / 燃燒等，在敵方回合前結算）
  if(e.dot && e.dotTurns > 0){
    const d = e.dot;
    e.hp = clamp(e.hp - d, 0, e.maxhp);
    e.dotTurns--;
    say(`☠️ <b>${e.name}</b> 受到持續傷害 <span class="bad">-${d}</span>。`);
    if(e.hp <= 0){ return endBattle(true); }
  }

  // 防禦 Debuff 回合數遞減
  if(e.defDown && e.defDownTurns > 0){
    e.defDownTurns--;
    if(e.defDownTurns <= 0){
      e.defDown = 0;
      say(`🛡️ <b>${e.name}</b> 的防禦恢復了。`);
    }
  }
  if(e.hitDown && e.hitDownTurns > 0){
    const missRate = e.hitDown;
    e.hitDownTurns--;
    if(Math.random() < missRate){
      say(`💨 <b>${e.name}</b> 的攻擊落空。`);
      if(e.hitDownTurns <= 0){ e.hitDown = 0; say(`🎯 <b>${e.name}</b> 的命中恢復正常。`); }
      return;
    }
    if(e.hitDownTurns <= 0){ e.hitDown = 0; say(`🎯 <b>${e.name}</b> 的命中恢復正常。`); }
  }

  let enemyAtk = e.atk;
  if(e.atkDown && e.atkDownTurns > 0){
    enemyAtk = Math.max(1, Math.floor(enemyAtk * (1 - e.atkDown)));
    e.atkDownTurns--;
    if(e.atkDownTurns <= 0){ e.atkDown = 0; say(`💢 <b>${e.name}</b> 的攻勢恢復。`); }
  }

  let dmg=Math.max(1, rnd(enemyAtk-1,enemyAtk+3)-p.def);
  const dmgTakenBonus = berserkerDamageTakenBonus();
  if(dmgTakenBonus>0){
    dmg = Math.max(1, Math.floor(dmg * (1 + dmgTakenBonus)));
  }
  const guard = game.state.guardMitigation || {ratio:0,turns:0};
  if(guard.ratio>0){
    dmg = Math.max(0, Math.floor(dmg * (1-guard.ratio)));
    guard.turns = Math.max(0, (guard.turns||0)-1);
    if(guard.turns<=0) game.state.guardMitigation={ratio:0,turns:0};
    else game.state.guardMitigation=guard;
  }

  if(game.state.playerShield>0 && dmg>0){
    const absorbed=Math.min(game.state.playerShield,dmg);
    game.state.playerShield-=absorbed;
    dmg-=absorbed;
    say(`🛡️ 護盾吸收了 ${absorbed} 傷害。`);
  }

  const manaShieldLv = skillLevel("ManaShield",0);
  if(manaShieldLv>0 && dmg>0 && p.mp>0){
    const mpAbsorb = Math.min(p.mp, Math.ceil(dmg * (0.5 + 0.05*manaShieldLv)));
    p.mp = Math.max(0, p.mp - mpAbsorb);
    const reduced = Math.min(dmg, mpAbsorb);
    dmg = Math.max(0, dmg - reduced);
    say(`🔷 魔力護盾抵銷 ${reduced} 傷害。`);
  }

  p.hp=clamp(p.hp-dmg,0,p.maxhp);
  gainWarInstinctStack(1);
  say(`<b>${e.name}</b> 攻擊了你，<span class="bad">-${dmg}</span>。`);
  if(p.hp<=0) return endBattle(false);

  if(game.state.counterReady){
    game.state.counterReady=false;
    if(e.hp>0){
      const effDef=effectiveEnemyDef(e,p);
      let out=Math.max(1, Math.floor((rnd(p.atk-2,p.atk+2)-effDef) * 1.1));
      out = critMaybe(p,out,"physical");
      out = applySpeedBonus(p,out);
      e.hp = clamp(e.hp - out, 0, e.maxhp);
      say(`🛡️ 你趁勢反擊，造成 <span class="hp">-${out}</span>。`);
      if(e.hp<=0) return endBattle(true);
    }
  }

  render();
  }
  function endBattle(victory){
    const e=game.state.enemy; game.state.inBattle=false; game.state.enemy=null; $("#runBtn").disabled=true;
    game.state.wildHowl={turns:0};
    game.state.bloodUnleash={turns:0};
    resetWarInstinctStacks();
    if(victory){
      const z=currentZone(); let gold=e.gold, exp=e.exp;
      const mult = 1 + activeXpBuffs(); // 每層 +100%，=1+層數
      const finalExp = Math.floor(exp*mult);
      game.player.gold+=gold; gainExp(finalExp);
      game.state.kills[e.name]=(game.state.kills[e.name]||0)+1;
      updatePassivesOnKill();
      handleDrops(e);
      say(`🏆 勝利！（${z.name}）獲得 <b>${gold}G</b> 與 <b>${finalExp} EXP</b>（加倍層數 ${activeXpBuffs()}）。`);
      if(Math.random()<0.35){ advanceDay(1); }
    } else {
      const lostExp=Math.floor(game.player.exp*0.5), lostGold=Math.floor(game.player.gold*0.2);
      game.player.exp=Math.max(0, game.player.exp - lostExp);
      game.player.gold=Math.max(0, game.player.gold - lostGold);
      say(`💀 你倒下了……損失 <b>${lostExp} EXP</b> 與 <b>${lostGold} G</b>。`);
      const p=game.player; p.hp=Math.max(10,Math.round(p.maxhp*0.5)); p.mp=Math.max(5,Math.round(p.maxmp*0.5));
    }
    render(); autosave();
  }
  function gainExp(v){
    // 🔧 經驗倍率入口：所有來源的 EXP 都會先乘上 EXP_RATE
    const rate = (typeof EXP_RATE !== "undefined" ? EXP_RATE : 1);
    const add  = Math.floor(v * rate);

    const p = game.player;
    p.exp += add;

    while(p.exp >= expNeedForLevel(p.lvl)){
      p.exp -= expNeedForLevel(p.lvl);

      const before = {
        maxhp: p.maxhp,
        maxmp: p.maxmp,
        atk:   p.atk,
        def:   p.def
      };

      refreshSkillPointBuckets();
      const beforePools = { ...(game.player.skillPointsByTier||{}) };

      p.lvl++;
      p.freeStatPoints = (p.freeStatPoints||0) + 5;
      recalcPlayerStats();
      p.hp = p.maxhp;
      p.mp = p.maxmp;

      refreshSkillPointBuckets();
      const tier = skillPointTierForLevel(p.lvl) ?? 0;
      const gained = Math.max(0, freeSkillPointsForTier(tier) - (beforePools?.[tier]||0));
      const tierPool = freeSkillPointsForTier(tier);

      say(
        `🎉 升級到 <b>Lv.${p.lvl}</b>！` +
        `｜${tierLabel(tier)}技能點 +${gained}（該階剩餘 ${tierPool}）` +
        `｜屬性點 +5（共 ${p.freeStatPoints}）。`
      );

      checkUnlocks();
      if(p.lvl % 10 === 0) refreshQuestsForLevel(p.lvl);
    }
  }

  function updatePassivesOnKill(){
    const job=game.player.job;
    game.player.passiveKills[job]=(game.player.passiveKills[job]||0)+1;
    if(game.player.passiveKills[job]%100===0){
      const id = jobPassiveId(job);
      if(id){
        game.player.learned[id]=(game.player.learned[id]||0)+1;
        say(`✨ 你的職業被動 <b>${SKILL[id].name}</b> 提升至 Lv.${game.player.learned[id]}（每 100 擊殺）。`);
      }
    }
  }
  function jobPassiveId(job){
    const j=JOB_TREE.find(x=>x.key===job); if(!j) return null;
    return (j.key==="Warrior"||j.key==="Paladin") ? "vitality" : "focus";
  }
// =============================
// 🟥 神器系統 3.0：Boss 專屬神器 + 碎片合成
// =============================

// 每個 Boss 的專屬神器清單：只用 slot / weapon / base 來控制強度
// slot: "weapon" / "armor" / "acc"
// weapon: 新武器分類字串（只有武器才需要）
const BOSS_ARTIFACT_DATA = {
  "火龍":{
    fragmentName:"[火龍神器碎片]",
    artifacts:[
      {slot:"weapon", weapon:"長劍盾", name:"燼焰斬界劍", base:{atk:110, def:8,  hp:60,  mp:20}},
      {slot:"weapon", weapon:"法杖",  name:"焰心詠咒杖", base:{atk:90,  def:6,  hp:40,  mp:60}},
      {slot:"weapon", weapon:"雙刀",  name:"赤燄影牙刃", base:{atk:100, def:6,  hp:40,  mp:20}},
      {slot:"weapon", weapon:"長弓",  name:"熾翼裂焰弓", base:{atk:105, def:8,  hp:50,  mp:30}},
      {slot:"armor",               name:"熾鱗君王鎧", base:{atk:20,  def:80, hp:260, mp:40}},
      {slot:"armor",               name:"焰翼戰袍",   base:{atk:30,  def:60, hp:200, mp:80}},
      {slot:"acc",                 name:"紅蓮誓約戒", base:{atk:40,  def:20, hp:120, mp:40}},
      {slot:"acc",                 name:"燼心龍牙鏈", base:{atk:50,  def:15, hp:100, mp:60}}
    ]
  },
  "暴雪巨靈":{
    fragmentName:"[暴雪巨靈神器碎片]",
    artifacts:[
      {slot:"weapon", weapon:"法杖",  name:"霜域審判杖", base:{atk:80,  def:12, hp:80,  mp:80}},
      {slot:"weapon", weapon:"長劍盾", name:"冰脈裂嶺劍", base:{atk:95,  def:18, hp:80,  mp:30}},
      {slot:"weapon", weapon:"雙刀",  name:"凜鋒碎霜刃", base:{atk:90,  def:16, hp:60,  mp:40}},
      {slot:"weapon", weapon:"長弓",  name:"霜刻冰牙弓", base:{atk:92,  def:16, hp:70,  mp:40}},
      {slot:"armor",               name:"永凍巨靈鎧", base:{atk:10,  def:110, hp:320, mp:40}},
      {slot:"armor",               name:"雪紋護法袍", base:{atk:15,  def:80,  hp:260, mp:80}},
      {slot:"acc",                 name:"霜心環印",   base:{atk:25,  def:30,  hp:160, mp:60}},
      {slot:"acc",                 name:"寒魄冰晶鏈", base:{atk:20,  def:35,  hp:140, mp:80}}
    ]
  },
  "深淵之眼":{
    fragmentName:"[深淵之眼神器碎片]",
    artifacts:[
      {slot:"weapon", weapon:"法杖",  name:"深淵凝視杖", base:{atk:85,  def:8,  hp:40,  mp:110}},
      {slot:"weapon", weapon:"雙刀",  name:"冥潮噬魂刃", base:{atk:100, def:10, hp:40,  mp:80}},
      {slot:"weapon", weapon:"長劍盾", name:"暗潮絕鳴劍", base:{atk:105, def:8,  hp:50,  mp:70}},
      {slot:"weapon", weapon:"長弓",  name:"獄淵裂息弓", base:{atk:100, def:9,  hp:45,  mp:90}},
      {slot:"armor",               name:"深淵觀測袍", base:{atk:20,  def:55, hp:200, mp:120}},
      {slot:"armor",               name:"虛渦棱光甲", base:{atk:25,  def:65, hp:220, mp:100}},
      {slot:"acc",                 name:"渦心瞳戒",   base:{atk:25,  def:20, hp:120, mp:100}},
      {slot:"acc",                 name:"深淵囁語鏈", base:{atk:20,  def:20, hp:100, mp:120}}
    ]
  },
  "星墜魔像":{
    fragmentName:"[星墜魔像神器碎片]",
    artifacts:[
      {slot:"weapon", weapon:"長劍盾", name:"隕星斷界刃", base:{atk:105, def:20, hp:80,  mp:30}},
      {slot:"weapon", weapon:"法杖",  name:"星核導引杖", base:{atk:85,  def:18, hp:80,  mp:70}},
      {slot:"weapon", weapon:"雙刀",  name:"星蝕裂殘刃", base:{atk:95,  def:18, hp:70,  mp:40}},
      {slot:"weapon", weapon:"長弓",  name:"墜星震雷弓", base:{atk:100, def:19, hp:75,  mp:50}},
      {slot:"armor",               name:"星墜重核鎧", base:{atk:10,  def:120, hp:360, mp:40}},
      {slot:"armor",               name:"流隕披風袍", base:{atk:20,  def:80,  hp:260, mp:80}},
      {slot:"acc",                 name:"星塵權衡戒", base:{atk:25,  def:30,  hp:160, mp:60}},
      {slot:"acc",                 name:"墜星共鳴鏈", base:{atk:25,  def:25,  hp:160, mp:80}}
    ]
  },
  "終末領主":{
    fragmentName:"[終末領主神器碎片]",
    artifacts:[
      {slot:"weapon", weapon:"長劍盾", name:"終焉審判劍", base:{atk:130, def:24, hp:90,  mp:60}},
      {slot:"weapon", weapon:"法杖",  name:"末日詔令杖", base:{atk:120, def:20, hp:80,  mp:90}},
      {slot:"weapon", weapon:"雙刀",  name:"墜星終刻刃", base:{atk:125, def:22, hp:80,  mp:70}},
      {slot:"weapon", weapon:"長弓",  name:"終末審決弓", base:{atk:125, def:22, hp:85,  mp:75}},
      {slot:"armor",               name:"終末權威鎧", base:{atk:20,  def:130, hp:380, mp:80}},
      {slot:"armor",               name:"終焉聖紋袍", base:{atk:30,  def:95,  hp:280, mp:120}},
      {slot:"acc",                 name:"審判王座戒", base:{atk:35,  def:35,  hp:180, mp:80}},
      {slot:"acc",                 name:"終焉心臟鏈", base:{atk:35,  def:30,  hp:180, mp:100}}
    ]
  }
};

// 從某個 Boss 的清單裡隨機挑一件神器模板
function pickBossArtifactDef(bossName){
  const cfg = BOSS_ARTIFACT_DATA[bossName];
  if(!cfg || !cfg.artifacts || !cfg.artifacts.length) return null;
  const list = cfg.artifacts;
  const idx = typeof rnd === "function" ? rnd(0, list.length-1) : Math.floor(Math.random()*list.length);
  return list[idx];
}

// 建立一件 Boss 神器實體（回傳裝備 id）
function createBossArtifact(bossName){
  const def = pickBossArtifactDef(bossName);

  // 萬一表沒填好就退回舊的隨機神器產生器當保險
  if(!def){
    if(typeof rollArtifactStatsForSlot === "function" &&
       typeof generateArtifactName === "function" &&
       typeof ensureUniqueName === "function"){
      const roll = rollArtifactStatsForSlot();
      const genName = ensureUniqueName(generateArtifactName(roll.slot, roll.weapon));
      const base = {
        atk: roll.stats.atk * 4,
        def: roll.stats.def * 3,
        hp:  roll.stats.hp  * 4,
        mp:  roll.stats.mp  * 3
      };
      const id = makeEquipInstance(`[神器_${genName}]`,"神器",roll.slot,roll.weapon,base);
      const inst = getEquipInstance(id);
      if(typeof addRandomAffixN === "function")      addRandomAffixN(inst,2);
      else if(typeof addRandomAffix === "function"){ addRandomAffix(inst); addRandomAffix(inst); }
      return id;
    }
    return null;
  }

// 內部只存「Boss名·武器名」，不要含[神器_]，顯示時再組
const innerName = `${bossName}·${def.name}`;
const id = makeEquipInstance(innerName,"神器",def.slot,def.weapon||null,def.base);

  const inst = getEquipInstance(id);

  // 詞條：武器 2 條、防具／飾品 1 條，走你原本的 AFFIX 系統
  if(inst){
    if(typeof addRandomAffixN === "function"){
      const n = def.slot==="weapon" ? 2 : 1;
      addRandomAffixN(inst,n);
    }else if(typeof addRandomAffix === "function"){
      addRandomAffix(inst);
      if(def.slot==="weapon") addRandomAffix(inst);
    }
  }
  return id;
}
// ✅ 確保某個 Boss 的神器碎片已經在 itemDefs 裡註冊成可使用道具
function ensureArtifactFragmentDef(bossName){
  const cfg = BOSS_ARTIFACT_DATA[bossName];
  if(!cfg) return;

  const fragName = cfg.fragmentName;

  // 已經有定義就不用重複
  if(itemDefs[fragName]) return;

  itemDefs[fragName] = {
    type:"consum",
    desc:`${bossName} 專屬神器碎片。收集 5 片可隨機合成一件 ${bossName} 的神器裝備。`,
    use:(p)=>{
      // 目前碎片數量
      const have = game.inv[fragName] || 0;

      // 不足 5 片 → 只提示，不扣數量
      if(have < 5){
        say(`🧩 ${fragName}：目前 <b>${have}</b>/5，尚不足以合成神器。`);
        return;
      }

      // 足夠才扣 5 片
      game.inv[fragName] = have - 5;
      if(game.inv[fragName] <= 0) delete game.inv[fragName];

      // 開始合成神器
      const id = createBossArtifact(bossName);
      if(!id){
        say("❌ 合成失敗：神器資料表有問題，請回報作者。");
        return;
      }
      const inst = getEquipInstance(id);
      addInv(id,1);
      say(`🟥 合成完成：<b>${inst?.name||"未知神器"}</b>！`);
      render();
    }
  };
}
// ✅ 遊戲啟動時呼叫：把所有 Boss 的碎片道具都先註冊好
function initAllArtifactFragments(){
  Object.keys(BOSS_ARTIFACT_DATA).forEach(name=>{
    ensureArtifactFragmentDef(name);
  });
}

// 掉落一片 Boss 神器碎片（並確保道具定義存在）
function dropArtifactFragmentFromBoss(bossName){
  const cfg = BOSS_ARTIFACT_DATA[bossName];
  if(!cfg) return;

  const fragName = cfg.fragmentName;

  // 先確保碎片道具有定義（只會做一次）
  ensureArtifactFragmentDef(bossName);

  // 實際給碎片
  addInv(fragName,1);
  say(`🧩 你獲得神器碎片：<b>${fragName}</b>！`);
}


// 🔍 檢查：目前是否有「需要任務藥水」的進行中任務
function hasActiveQuestNeedTaskPotion(){
  const qs = Array.isArray(game.quests) ? game.quests : [];
  return qs.some(q=>{
    if(q.state !== "active") return false;
    const req = q.req || {};
    // 新任務系統：使用 submitItems 形式
    if(req.submitItems && req.submitItems["任務藥水"]) return true;
    // 舊格式相容：如果有寫 req.item / req.count
    if(req.item === "任務藥水" && (req.count || 0) > 0) return true;
    return false;
  });
}

  
function handleDrops(e){
  // 🌟 全地圖稀有掉落：ㄅㄅㄐ之錘（1% 機率，每次戰鬥結算判定一次）
  if(Math.random() < 0.005){
    addInv("ㄅㄅㄐ之錘",1);
    say(`🌟 你獲得了稀有道具：<b>ㄅㄅㄐ之錘</b>！`);
  }

  (e.drops || []).forEach(d=>{
      // 一般道具
    if(d.item && Math.random() < d.rate){

      // 任務藥水特殊規則：
      // 只有在有「需要任務藥水」的進行中任務時，才會真的掉
      if(d.item === "任務藥水" && !hasActiveQuestNeedTaskPotion()){
        // 沒有相關任務，這次就當作沒掉
        return;
      }

      addInv(d.item,1);
      say(`📖 掉落：<b>${d.item}</b>！`);
    }


    // 白裝
    if(d.equip && Math.random() < d.rate){
      addEquipToInv(d.equip,"白");
    }

    // 坐騎
    if(d.mount && Math.random() < d.rate){
      addMountToInv(d.mount);
      say(`🐎 你獲得坐騎：<b>${d.mount}</b>！`);
    }

    // 🧩 Boss 神器碎片（Boss 掉落表用 artifactBoss 設定）
    if(d.artifactBoss && Math.random() < d.rate){
      dropArtifactFragmentFromBoss(d.artifactBoss);
    }
  });
}


  


  function rollArtifactAffix(){
    const slots=["weapon","armor","acc"]; const slot=slots[rnd(0,slots.length-1)];
    const weapon = slot==="weapon" ? ["blade","staff","dagger"][rnd(0,2)] : null;
    return {slot, weapon, stats:{
      atk: rnd(3,7), def: rnd(2,5), hp: rnd(12,30), mp: rnd(6,18)
    }};
  }
// ===========================================
// 🟣 相容層：讓 handleDrops() 呼叫到的接口存在
// 內部直接沿用你現有的 rollArtifactAffix() 結果
// ===========================================
function rollArtifactStatsForSlot() {
  if (typeof rollArtifactAffix === "function") {
    return rollArtifactAffix(); // 期望回傳 {slot, weapon, stats:{atk,def,hp,mp}}
  }
  // 防呆預設
  const slots = ["weapon","armor","acc"];
  const slot = slots[Math.floor(Math.random()*slots.length)];
  const weapon = slot==="weapon" ? ["blade","staff","dagger"][Math.floor(Math.random()*3)] : null;
  return { slot, weapon, stats:{ atk:5, def:3, hp:20, mp:12 } };
}
//===========================================
  /* ========= 背包 / 裝備 / 強化 / 合成 ========= */
  const invDlg=$("#invDlg"), invList=$("#invList"), invFilters=$("#invFilters"), equipCompare=$("#equipCompare");

  const invCats=[
    {key:"all",name:"全部"},
    {key:"weapon",name:"武器"},
    {key:"equip",name:"防具/飾品"},
    {key:"consum",name:"消耗品"},
    {key:"mount",name:"坐騎"},
    {key:"enh",name:"強化道具"}
  ];
  let invFilter="all";
  function invCategory(name, meta){
    // 強化道具：獨立分類（比其他優先）
    const isEnh = meta.type === "enh" || /錘|鎚|強化|神器碎片/.test(name);
    if(isEnh) return "enh";

    // 裝備：依槽位拆分「武器」與「防具/飾品」
    if(meta.type === "equip"){
      const eq = getEquipInstance(name);
      if(eq?.slot === "weapon") return "weapon";
      return "equip";
    }

    // 坐騎：對應 shop 類別
    if(meta.type === "mount") return "mount";

    // 可使用道具（包含技能書）：歸到消耗品
    if(meta.type === "consum" || meta.type === "book") return "consum";

    // 其他：保留原型別，至少能在「全部」裡看見
    return meta.type || "misc";
  }

  function openInventory(){
    if(equipCompare) equipCompare.innerHTML = "";   // 打開背包先清空比較
    renderInvFilters();
    renderInventoryList();
    invDlg.showModal();
  }

  function renderInvFilters(){
    invFilters.innerHTML="";
    invCats.forEach(c=>{
      const b=btn(`${c.name}`,()=>{ invFilter=c.key; renderInventoryList(); });
      if(invFilter===c.key) b.classList.add("active");
      invFilters.appendChild(b);
    });
  }
  function refreshInventoryListIfOpen(){
    if(invDlg && invDlg.open){
      renderInventoryList();
    }
  }
  function refreshSkillListIfOpen(){
    if(typeof skillDlg !== "undefined" && skillDlg && skillDlg.open){
      renderSkillList();
    }
  }
  function renderInventoryList(){
    // 舊版存檔可能把「裝備模板名稱」直接塞進背包，導致沒有 E# 實例而無法比較
    const entries = Object.entries(game.inv);
    let convertedLegacyEquip = false;

    entries.forEach(([name, count])=>{
      if(name.startsWith("E#")) return;       // 已是實例
      const tpl = EQUIPS[name];               // 只處理裝備模板名稱
      if(!tpl || !count) return;

      delete game.inv[name];                  // 移除舊格式
      for(let i=0; i<count; i++){
        const id = makeEquipInstance(name, tpl.qual, tpl.slot, tpl.weapon||null, {
          atk:tpl.atk, def:tpl.def, hp:tpl.hp, mp:tpl.mp,
          str:tpl.str, agi:tpl.agi, int:tpl.int, spi:tpl.spi
        });
        game.inv[id] = (game.inv[id] || 0) + 1;
      }
      convertedLegacyEquip = true;
    });

    if(convertedLegacyEquip){
      autosave();
    }

    invList.innerHTML = '';

    const sorted = Object.entries(game.inv);
    if(sorted.length === 0){
      invList.innerHTML = `<div class="row"><span class="muted">（空）</span></div>`;
      return;
    }

    // 先把道具轉成含 meta 的陣列
    let arr = sorted.map(([name, count])=>{
      const meta = invMeta(name);
      const cat  = invCategory(name, meta);
      return { name, count, meta, cat };
    });

    // 依目前的分類過濾（與商店一致）
    if(invFilter !== "all"){
      arr = arr.filter(e => e.cat === invFilter);
    }

    if(arr.length === 0){
      invList.innerHTML = `<div class="row"><span class="muted">（此分類目前沒有道具）</span></div>`;
      return;
    }

    // 類型排序優先順序：武器→防具/飾品→坐騎→消耗品（含技能書）→強化道具→其他
    const typeOrder = { weapon:0, equip:1, mount:2, consum:3, enh:4, misc:5 };

    // ✅ 排序規則：
    // 1) 依 typeOrder
    // 2) 同類型再依 displayInvName 的字母/中文字排序
    arr.sort((a, b)=>{
      const ta = typeOrder[a.cat] ?? 99;
      const tb = typeOrder[b.cat] ?? 99;
      if(ta !== tb) return ta - tb;

      const da = displayInvName(a.name);
      const db = displayInvName(b.name);
      return da.localeCompare(db, "zh-Hant");
    });

    // 依排序後結果畫列表
    arr.forEach(({name, count, meta})=>{
      const row   = document.createElement("div"); row.className = "row";
      const right = document.createElement("div"); right.className = "right";

      let lineTitle = `<b>${displayInvName(name)}</b> × ${count}`;
      let extra = "";

      if(meta.type === "equip"){
        const eq = getEquipInstance(name);
        const req = equipRestrictionText(eq);
        extra = `｜ATK ${eq.atk||0} DEF ${eq.def||0} HP ${eq.hp||0} MP ${eq.mp||0}${eq.plus?`｜+${eq.plus}`:""}${affixShort(eq)}｜${req}`;
        right.append(btn("裝備", ()=>{
          const eqInst = getEquipInstance(name);
          if(eqInst) showEquipCompare(name, eqInst);
          equipItem(name);
        }));

        // 合成：白→綠→藍（同名 3 件）
        const q = eq.qual || "白";
        if(QUALITY_ORDER[q] < QUALITY_ORDER["藍"]){
          const need = 3;
          let cnt = 0;
          Object.entries(game.inv).forEach(([k,v])=>{
            const e2 = getEquipInstance(k);
            if(e2 && e2.name === eq.name && e2.qual === eq.qual){ cnt += v; }
          });
          if(cnt >= need){
            right.append(btn("合成升階", ()=>{ combineEquip(name, need); }));
          }
        }

           }else if(meta.type === "consum"){
        const def = itemDefs[meta.ref] || {};
        extra = `｜${def.desc || ""}`;

        // 🟢 單次使用（原本功能）
        right.append(btn("使用", ()=>{ 
          useItem(name); 
          renderInventoryList(); 
        }));

        // 🟣 批量使用（只有非戰鬥中才允許一次用多個）
        right.append(btn("批量使用", ()=>{
          const have = game.inv[name] || 0;
          if(have <= 0) return;

          // 戰鬥中禁止一次吃很多，避免怪物一直輪流行動
          if(game.state && game.state.inBattle){
            say("⚔ 戰鬥中一次只能使用 1 個。");
            useItem(name);
            renderInventoryList();
            return;
          }

          const input = prompt(`你有 ${have} 個 ${displayInvName(name)}。\n要一次使用幾個？`, "1");
          if(input === null) return; // 按取消
          const n = parseInt(input, 10);
          if(isNaN(n) || n <= 0){
            alert("請輸入大於 0 的整數。");
            return;
          }

          const times = Math.min(n, have);
          for(let i = 0; i < times; i++){
            if((game.inv[name] || 0) <= 0) break; // 用到沒了就停
            useItem(name);
          }

          renderInventoryList();
        }));

        // 藥水 2 合 1（只對治療藥水鏈）
        const next = nextPotionName(meta.ref);
        if(next && (game.inv[name] || 0) >= 2){
          right.append(btn("合成→下一級", ()=>{ 
            combinePotion(meta.ref); 
            renderInventoryList(); 
          }));
        }

      }else if(meta.type === "book"){
        const skillId = itemDefs[meta.ref]?.skill;
        const sk = SKILL[skillId];
        extra = `｜學習/升級：${sk ? sk.name : "未知"}`;
        right.append(btn("閱讀", ()=>{ useBook(name); renderInventoryList(); }));

      }else if(meta.type === "mount"){
        const m = getMountInstance(name);
        const mAtk = m?.atk || 0,
              mDef = m?.def || 0,
              mHp  = m?.hp  || 0,
              mMp  = m?.mp  || 0,
              mSpd = m?.spd || 0;
        const statText = formatStatSummary({atk:mAtk,def:mDef,hp:mHp,mp:mMp}, {delimiter:" "});
        extra = `｜${statText}｜SPD ${mSpd}`;
        right.append(btn("裝備坐騎", ()=>{ equipMount(name); renderInventoryList(); }));
      }
      
      // 點整列來預覽＆比較（按鈕本身不觸發）
      row.onclick = (ev)=>{
        if(ev.target.closest("button")) return;   // 點到按鈕就交給原本功能
        if(meta.type === "equip"){
          const eqInst = getEquipInstance(name);
          if(eqInst) showEquipCompare(name, eqInst);
        }
      };

      // 販售
      right.append(btn("販售", ()=>sellSingle(name)));

      row.innerHTML = `<div>${lineTitle} <span class="tag">${extra}</span></div>`;
      row.append(right);
      invList.appendChild(row);
    });
  }
  // 顯示裝備比較（背包選取 vs 身上裝備）
  function showEquipCompare(id, eq){
    if(!equipCompare) return;

    const p = game.player;
    const slot = eq.slot;

    // 只有武器 / 防具 / 飾品有比較意義
    if(!slot || !["weapon","armor","acc"].includes(slot)){
      equipCompare.innerHTML = `<div class="hint">此裝備沒有對應比較槽位。</div>`;
      return;
    }

    const eid = p.equip[slot];
    if(!eid){
      equipCompare.innerHTML = `<div class="hint">目前此槽位尚未裝備任何裝備。</div>`;
      return;
    }

    const cur = getEquipInstance(eid);
    if(!cur){
      equipCompare.innerHTML = `<div class="hint">目前身上裝備資料異常，請重新裝備一次。</div>`;
      return;
    }

    // 詞條內文（如果沒有詞條就顯示「無特殊詞條」）
    const affixText = (inst)=>{
      const s = affixShort(inst);
      return (s && s.trim()) ? s : "（無特殊詞條）";
    };

    // 取得詞條顯示名稱
    const affixLabel = (key)=>{
      const def = AFFIX_LIB.find(x=>x.key===key);
      return def ? (def.name || key) : key;
    };

    // 詞條變化描述：新增／移除什麼詞條
    const affixChange = (oldInst, newInst)=>{
      const oldKeys = (oldInst?.affix || []).map(a=>a.key);
      const newKeys = (newInst?.affix || []).map(a=>a.key);

      const added   = newKeys.filter(k => !oldKeys.includes(k));
      const removed = oldKeys.filter(k => !newKeys.includes(k));

      const parts = [];
      if(added.length)   parts.push(`新增：${added.map(affixLabel).join("、")}`);
      if(removed.length) parts.push(`移除：${removed.map(affixLabel).join("、")}`);

      return parts.length ? parts.join("｜") : "無變化";
    };

    equipCompare.innerHTML = `
      <div class="row" style="flex-direction:column;align-items:flex-start">
        <div><b>目前裝備：</b>${displayEquipName(eid)}｜${formatStatSummary(cur, {delimiter:"｜"})}｜${equipRestrictionText(cur)}</div>
        <div class="eq-affix-line"><b>目前詞條：</b>${affixText(cur)}</div>

        <div><b>背包選取：</b>${displayEquipName(id)}｜${formatStatSummary(eq, {delimiter:"｜"})}｜${equipRestrictionText(eq)}</div>
        <div class="eq-affix-line"><b>背包詞條：</b>${affixText(eq)}</div>

        <div><b>差異（背包 − 身上）：</b>${formatStatDiff(eq, cur)}</div>
        <div><b>詞條變化：</b>${affixChange(cur, eq)}</div>
      </div>
    `;
  }

  
  function invMeta(key){
    if(key.startsWith("E#")) return {type:"equip"};
    if(key.startsWith("M#")) return {type:"mount"};
    const ref = itemDefs[key];
    if(ref){ return {type: ref.type, ref:key}; }
    return {type:"misc"};
  }
 function useItem(key){
  const p = game.player;
  const meta = invMeta(key);
  if (meta.type !== "consum") return;

  const def = itemDefs[meta.ref];
  if (!def) return;

  // 先執行道具本身的效果
  def.use(p, game.state.enemy, game.state.inBattle);

  // 🧩 特例：
  // 1) 神器碎片（名稱裡包含「神器碎片」）
  // 2) ㄅㄅㄐ之錘（在 use 裡自己 decInv）
  // 3) 錢袋（在 use 裡自己 decInv）
  // 這三種道具在自己的 use() 裡已經處理數量，不要再自動扣 1 次
  if (
    !meta.ref.includes("神器碎片") &&
    meta.ref !== "ㄅㄅㄐ之錘" &&
    meta.ref !== "錢袋"
  ) {
    decInv(key, 1);
  }

  render();
  if (game.state.inBattle) enemyTurn();
}


function combinePotion(name){
  const next = nextPotionName(name);
  if (!next) return say("此物品不可再合成。");

  const have = game.inv[name] || 0;
  if (have < 2) return say("需要至少 2 瓶同級藥水。");

  // 一次把能合的都合掉：每 2 瓶 → 1 瓶下一級
  const times = Math.floor(have / 2);   // 可以合成幾次
  const cost  = times * 2;              // 會消耗幾瓶
  const gain  = times;                  // 會得到幾瓶下一級藥水

  decInv(name, cost);   // 扣掉原本藥水
  addInv(next, gain);   // 給予新藥水

  say(`⚗️ 批量合成：<b>${name}</b> ×${cost} → <b>${next}</b> ×${gain}`);
}


  function useBook(key){
    const meta=invMeta(key); if(meta.type!=="book") return;
    const skill = itemDefs[meta.ref]?.skill; if(!skill) return;
    learnOrUpgradeSkill(skill, meta.ref);
  }

  
/* === 技能書升級設定 ===========================
   可改參數（依你喜好調整）
----------------------------------------------- */
const SKILL_MAX_LV = 25;           // 每個品質的等級上限（原本 25）
const SKILL_QUALITY_UP = true;     // 滿級後是否升一階品質並重置等級
const SKILL_UP_GOLD_COST = 0;      // 升級額外需要的金幣（0=不需要）
// 升級需求模式：選一種
//  "pow2"   : 2^當前等級（原本的作法，如 Lv1→1本，Lv2→2本，Lv3→4本…）
//  "linear" : 每級固定 1 本
//  "arith"  : 1, 2, 3, 4…（等級越高越多）
//  "custom" : 自訂公式（改下面的 calcSkillBooksNeeded）
const SKILL_BOOK_MODE = "custom";

/** 算升級需要幾本技能書（依當前等級 curLv） */
function calcSkillBooksNeeded(totalLv){
  switch(SKILL_BOOK_MODE){
    case "pow2":   return Math.pow(2, Math.max(0, totalLv));          // 原版
    case "linear": return 1;                                          // 每級 1 本
    case "arith":  return Math.max(1, totalLv);                       // 1,2,3,4…
    case "custom":
      // 依「總等級」（含品質）緩慢成長：起始 1 本，每 5 級多 1 本
      return 1 + Math.floor(Math.max(0, totalLv) / 5);
    default:       return 1;
  }
}


  function learnOrUpgradeSkill(id, bookName){
  const p = game.player;
  const sk = SKILL[id];
  if(!sk){ say("未知技能。"); return; }
  const maxLv = skillMaxLv(id);
  const cur = p.learned[id] || 0;

  const rootJob = rootJobOf(p.job);
  if(sk.tree && sk.tier > 0){
    if(!rootJob || rootJob !== sk.tree){
      say(`❌ 只有 ${jobName(sk.tree)} 系才能學習這個技能。`);
      return;
    }
  }

  if(!checkSkillTierAllowed(id)) return;

   // 需要的書本數（由設定決定）
  const qual = (p.skillQual && p.skillQual[id]) || 0;  // 技能目前品質階級
  const totalLv = cur + qual * maxLv;                  // 總等級 = 當前等級 + 品質階 * 上限
  const need = calcSkillBooksNeeded(totalLv);

  // 檢查書本是否足夠
  if( (game.inv[bookName]||0) < need ){
    say(`📘 升級需要 <b>${need}</b> 本 <b>${bookName}</b>（目前 ${game.inv[bookName]||0}）`);
    return;
  }

  // 檢查金幣是否足夠（若有設定）
  if(SKILL_UP_GOLD_COST > 0 && p.gold < SKILL_UP_GOLD_COST){
    say(`💰 升級需要 <b>${SKILL_UP_GOLD_COST}</b> 金幣（目前 ${p.gold}）`);
    return;
  }

  // 扣道具／金幣
  for(let i=0;i<need;i++) decInv(bookName,1);
  if(SKILL_UP_GOLD_COST > 0){ p.gold -= SKILL_UP_GOLD_COST; }

  // 未學會 → 學會 Lv.1
  if(cur === 0){
    p.learned[id] = 1;
    say(`📖 你學會了 <b>${SKILL[id].name}</b>！`);
  }
  // 已學會且未滿級 → 升一級
  else if(cur < maxLv){
    p.learned[id] = cur + 1;
    say(`📈 <b>${SKILL[id].name}</b> 升至 Lv.${p.learned[id]}（消耗 ${need} 本${SKILL_UP_GOLD_COST>0?`＋${SKILL_UP_GOLD_COST} 金幣`:``}）。`);
  }
  // 滿級後 → 是否升品質
  else{
    if(SKILL_QUALITY_UP){
      const q = (p.skillQual[id]||0) + 1;
      p.skillQual[id] = Math.min(q, QUALS.length-1);
      p.learned[id] = 1;
      say(`🌟 <b>${SKILL[id].name}</b> 升為 <b>${QUALS[p.skillQual[id]]}</b> 品質，等級重置為 Lv.1。`);
    }else{
      say(`🔒 <b>${SKILL[id].name}</b> 已達本品質上限 Lv.${maxLv}。`);
    }
  }
  // 主動技能：升級後自動設為當前技能（維持原行為）
  if(SKILL[id].type!=="被動"){ p.activeSkill = id; }
  render();
  refreshSkillListIfOpen();
  refreshInventoryListIfOpen();
  autosave();
}
function upgradeSkillByPoint(id){
  const sk = SKILL[id];
  if(!sk || sk.acquisition !== "point") return;
  refreshSkillPointBuckets();
  const cur = skillLevel(id,0);
  const max = skillMaxLv(id);
  if(cur >= max){ say(`🔒 <b>${sk.name}</b> 已達 Lv.${max}。`); return; }
  if(!checkSkillTierAllowed(id)) return;
  const tier = skillTier(id);
  const pool = freeSkillPointsForTier(tier);
  if(pool <= 0){ say(`${tierLabel(tier)}技能點數不足。`); return; }

  game.player.learned[id] = cur + 1;
  if(typeof sk.use === "function" && (cur===0 || !game.player.activeSkill)){ game.player.activeSkill = id; }
  refreshSkillPointBuckets();
  say(`📘 <b>${sk.name}</b> 升至 Lv.${game.player.learned[id]}（${tierLabel(tier)}剩餘技能點 ${freeSkillPointsForTier(tier)}）。`);
  recomputeStats(true);
  render();
  refreshSkillListIfOpen();
  autosave();
}
  function addInv(name,c=1){ game.inv[name]=(game.inv[name]||0)+c; autosave(); }
  function decInv(name,c=1){ if(!game.inv[name]) return; game.inv[name]-=c; if(game.inv[name]<=0) delete game.inv[name]; autosave(); }
  function addEquipToInv(baseName,qual="白"){
    const tpl=EQUIPS[baseName]; if(!tpl) return;
    const id = makeEquipInstance(baseName, qual, tpl.slot, tpl.weapon||null, {
      atk:tpl.atk,def:tpl.def,hp:tpl.hp,mp:tpl.mp,
      str:tpl.str,agi:tpl.agi,int:tpl.int,spi:tpl.spi
    });
    addInv(id,1);
    say(`🗡️ 獲得裝備：${fmtItem(baseName,qual)}。`);
  }
  function makeEquipInstance(name, qual, slot, weapon, stats){
    // 先用模板給的原始素質當 base
    let base = { ...(stats || {}) };
    // 白 / 綠 / 藍 → 用「固定素質表」覆蓋（依部位＋品質）
    if (["白","綠","藍"].includes(qual) &&
        FIXED_LOW_TIER[slot] &&
        FIXED_LOW_TIER[slot][qual]){
      base = { ...FIXED_LOW_TIER[slot][qual], ...base };
    }
    // 黃 / 橘 / 紫 → 沿用模板素質，之後靠強化成長
    const inst = {
      id:   "E#" + Math.random().toString(36).slice(2),
      name,
      qual,
      slot,
      weapon: weapon || null,
      atk: Math.round(base.atk || 0),
      def: Math.round(base.def || 0),
      hp:  Math.round(base.hp  || 0),
      mp:  Math.round(base.mp  || 0),
      str: Math.round(base.str || 0),
      agi: Math.round(base.agi || 0),
      int: Math.round(base.int || 0),
      spi: Math.round(base.spi || 0),
      plus:  0,
      stars: 0,
      affix: []
    };
    addEquip(inst);
    return inst.id;
  }

  function ensureStarterEquipment(){
    const p = game.player || {};
    if(!p.equip) p.equip = {weapon:null, armor:null, acc:null, mount:null};

    const starters = [
      {name:"新手武器", slot:"weapon"},
      {name:"新手毛衣", slot:"armor"},
      {name:"新手抱枕", slot:"acc"}
    ];

    starters.forEach(({name, slot})=>{
      const tpl = EQUIPS[name];
      if(!tpl) return;

      const currentId = p.equip[slot];
      const currentInst = currentId ? (getEquipInstance(currentId) || tryRestoreEquipFromSave(currentId)) : null;

      if(currentInst) return;

      const newId = makeEquipInstance(name, tpl.qual, tpl.slot, tpl.weapon||null, {
        atk:tpl.atk, def:tpl.def, hp:tpl.hp, mp:tpl.mp,
        str:tpl.str, agi:tpl.agi, int:tpl.int, spi:tpl.spi
      });
      p.equip[slot] = newId;
    });
  }

  function addMountToInv(name){
  const tpl = MOUNTS[name] || {};
  const inst = {
    id: "M#" + Math.random().toString(36).slice(2),
    name,
    // 坐騎四圍加成
    atk: tpl.atk || 0,
    def: tpl.def || 0,
    hp:  tpl.hp  || 0,
    mp:  tpl.mp  || 0,
    spd: tpl.spd || 0,
    desc: tpl.desc || ""
  };
  MOUNT_DB[inst.id] = inst;
  addInv(inst.id, 1);
}

  const EQUIP_DB={}; const MOUNT_DB={};
  function getEquipInstance(id){
    let inst = EQUIP_DB[id];
    if(!inst && typeof id === "string" && id.startsWith("E#")){
      inst = tryRestoreEquipFromSave(id);
    }
    return inst || null;
  }
  function getMountInstance(id){
    let inst = MOUNT_DB[id];
    if(!inst && typeof id === "string" && id.startsWith("M#")){
      inst = tryRestoreMountFromSave(id);
    }
    return inst || null;
  }

  // ✅ 註冊裝備實例到資料庫（修補 addEquip 未定義）
function addEquip(inst){
  // 防呆：若 EQUIP_DB 尚未存在，先建立
  if (typeof EQUIP_DB === "undefined") { window.EQUIP_DB = {}; }
  EQUIP_DB[inst.id] = inst;
}

  /* =============================== */
  /* [FIX] 裝備/坐騎顯示防呆＋自動從存檔還原實例 */
  /* =============================== */
  const __orig_displayEquipName = displayEquipName;
  const __orig_displayInvName   = displayInvName;
  function tryRestoreEquipFromSave(id){
    try{
      const raw=localStorage.getItem(LKEY);
      if(!raw) return null;
      const data=JSON.parse(raw);
      const found=data && data._eqdb && data._eqdb[id];
      if(found){ EQUIP_DB[id]=found; return found; }
    }catch(_){}
    return null;
  }
  function tryRestoreMountFromSave(id){
    try{
      const raw=localStorage.getItem(LKEY);
      if(!raw) return null;
      const data=JSON.parse(raw);
      const found=data && data._mddb && data._mddb[id];
      if(found){ MOUNT_DB[id]=found; return found; }
    }catch(_){}
    return null;
  }
displayEquipName = function(id){
  let inst = getEquipInstance(id);
  if(!inst && typeof id==="string" && id.startsWith("E#")){
    inst = tryRestoreEquipFromSave(id);
  }
  if(!inst){
    try{
      return __orig_displayEquipName(id);
    }catch(_){
      return "（裝備資料遺失）";
    }
  }
  const nameHtml = fmtItem(inst.name, inst.qual);   // ★ 套用品質顏色 ★
  const starHtml = (inst.qual === "紫" || inst.qual === "神器") && (inst.stars > 0)
    ? ` <span class="star">${inst.stars}☆</span>`
    : "";
  return `${nameHtml}${inst.plus ? ` +${inst.plus}` : ""}${starHtml}`;
};


  displayInvName = function(k){
    // 裝備實體 E#...
    if (typeof k === "string" && k.startsWith("E#")) {
      let inst = getEquipInstance(k);
      if (!inst) inst = tryRestoreEquipFromSave(k);
      if (!inst) return "（裝備資料遺失）";

      const tag      = categoryTagForKey(k);                 // ← 這行決定 [武器]/[防具]/[飾品]
      const baseName = fmtItem(inst.name, inst.qual);        // 依品質上色
      const starHtml = (inst.qual === "紫" || inst.qual === "神器") && (inst.stars > 0)
        ? ` <span class="star">${inst.stars}☆</span>` : "";

      return `${tag} ${baseName}${inst.plus ? ` +${inst.plus}` : ""}${starHtml}${affixShort(inst)}`;
    }

    // 坐騎實體 M#...
    if (typeof k === "string" && k.startsWith("M#")) {
      let m = getMountInstance(k);
      if (!m) m = tryRestoreMountFromSave(k);
      const tag = categoryTagForKey(k);                      // ← 這裡會變成 [坐騎]
      return m ? `${tag} ${m.name}` : `${tag} （坐騎資料遺失）`;
    }

    // 其他：交回原本版本處理（藥水、技能書等）
    return __orig_displayInvName ? __orig_displayInvName(k) : k;
  };

function equipItem(id){
  const inst = getEquipInstance(id); if(!inst) return;
  const allowed = JOB_WEAPON[game.player.job]||[];
  const series = jobSeries(game.player.job);
  const isNovice = game.player.job === "Novice";
  const bindSeries = inferEquipSeries(inst);
  if(inst.slot==="weapon" && inst.weapon && !allowed.includes(inst.weapon)){
    return say(`❌ 你的職業 <b>${jobName(game.player.job)}</b> 不能裝備此武器類型。`);
  }
  if(inst.slot!=="weapon" && bindSeries && !isNovice && bindSeries !== series){
    return say(`❌ 此裝備僅適用於 <b>${jobName(bindSeries)}</b> 系職業。`);
  }
  const slot=inst.slot; const old=game.player.equip[slot];
  if(old){ addInv(old,1); say(`你卸下了 <b>${displayEquipName(old)}</b>。`); }
  game.player.equip[slot]=id;
  decInv(id,1);
  say(`你裝備了 <b>${displayEquipName(id)}</b>。`);
  recomputeStats(false); render();
  refreshInventoryListIfOpen();
}

 function equipMount(id){
  const inst = getMountInstance(id); if(!inst) return;
  const p = game.player;
  const old = p.equip.mount;

  if(old){
    addInv(old,1);
    say(`你卸下了坐騎 <b>${displayInvName(old)}</b>。`);
  }

  p.equip.mount = id;
  decInv(id,1);
  say(`你騎上了 <b>${inst.name}</b>！`);

  recomputeStats(false); render();
  refreshInventoryListIfOpen();
}

  function unequipSlot(slot){
    const current = game.player.equip[slot];
    if(!current){
      return say("目前此槽位沒有裝備可脫下。");
    }

    addInv(current,1);
    game.player.equip[slot] = null;

    const label = slot === "mount" ? displayInvName(current) : displayEquipName(current);
    say(`你卸下了 <b>${label}</b>。`);

    recomputeStats(false);
    render();
    refreshInventoryListIfOpen();
  }


  function applyEquipMod(id,sign){
    const inst=getEquipInstance(id); if(!inst) return;
    const p=game.player;
    p.atk += sign*(inst.atk||0);
    p.def += sign*(inst.def||0);
    p.maxhp += sign*(inst.hp||0);
    p.maxmp += sign*(inst.mp||0);
    p.hp = clamp(p.hp,1,p.maxhp); p.mp=clamp(p.mp,0,p.maxmp);
  }
//套用坐騎加成函數
  function applyMountMod(id, sign){
  const m = getMountInstance(id); if(!m) return;
  const p = game.player;
  p.atk   += sign * (m.atk || 0);
  p.def   += sign * (m.def || 0);
  p.maxhp += sign * (m.hp  || 0);
  p.maxmp += sign * (m.mp  || 0);
  // 夾回合法區間
  p.hp = clamp(p.hp, 1, p.maxhp);
  p.mp = clamp(p.mp, 0, p.maxmp);
}

  
    // 合成（同名裝備 ×3 → 下一品質；上限藍）
  function combineEquip(id, need){
    const inst = getEquipInstance(id);
    if(!inst) return;

    const q = inst.qual || "白";
    if(QUALITY_ORDER[q] >= QUALITY_ORDER["藍"]){
      say("已達合成上限。");
      return;
    }

    const p = game.player;
    let cnt = 0;
    const keys = [];
    const equipSlots = [];

    // 1) 先數背包裡的同名同品質裝備
    Object.entries(game.inv).forEach(([k, v])=>{
      const eq = getEquipInstance(k);
      if(eq && eq.name === inst.name && eq.qual === inst.qual){
        cnt += v;
        keys.push([k, v]);
      }
    });

    // 2) 再把身上穿的同名同品質裝備也一起算進來
    ["weapon","armor","acc"].forEach(slot=>{
      const eid = p.equip[slot];
      if(!eid) return;
      const eq = getEquipInstance(eid);
      if(eq && eq.name === inst.name && eq.qual === inst.qual){
        cnt += 1;
        equipSlots.push(slot);
      }
    });

    if(cnt < need){
      say(`需要同名同品質裝備 ${need} 件（目前 ${cnt}）`);
      return;
    }

    // 3) 先從背包扣除素材
    let left = need;
    for(const [k, v] of keys){
      if(left <= 0) break;
      const take = Math.min(v, left);
      decInv(k, take);
      left -= take;
    }

    // 4) 不夠的話，再從身上裝備扣除（會直接拆掉裝備，並重新計算能力值）
    if(left > 0){
      for(const slot of equipSlots){
        if(left <= 0) break;
        const eid = p.equip[slot];
        if(!eid) continue;

        // 解除裝備：從能力值扣回去，並清空該槽位
        applyEquipMod(eid, -1);
        p.equip[slot] = null;
        left -= 1;
        say(`你消耗了身上裝備 <b>${displayEquipName(eid)}</b> 作為合成素材。`);
      }
    }

    // 5) 計算下一品質的實際屬性
    const next = QUALS[QUALITY_ORDER[q] + 1];

    const base = {
      atk: inst.atk || 0,
      def: inst.def || 0,
      hp : inst.hp  || 0,
      mp : inst.mp  || 0,
    };

    // 品質倍率表（照你原本的設定）
    const invMul = [1, 1.05, 1.1, 1.15, 1.2, 1.5];
    const curMul  = invMul[QUALITY_ORDER[q]];
    const nextMul = invMul[QUALITY_ORDER[next]];

    // 邏輯：先還原回「白品等價」→ 再套用下一階倍率（向上取整避免被吃掉）
    const baseWhite = {
      atk: Math.max(0, Math.round(base.atk / curMul)),
      def: Math.max(0, Math.round(base.def / curMul)),
      hp : Math.max(0, Math.round(base.hp  / curMul)),
      mp : Math.max(0, Math.round(base.mp  / curMul)),
    };

    // 產生新數值：向上取整；若原屬性>0且新值沒有比舊值大，保底+1
    function grow(oldVal, whiteVal){
      if(whiteVal <= 0) return 0;
      const scaled = Math.ceil(whiteVal * nextMul);
      return Math.max(scaled, oldVal + 1);
    }

    const newStats = {
      atk: grow(base.atk, baseWhite.atk),
      def: grow(base.def, baseWhite.def),
      hp : grow(base.hp,  baseWhite.hp),
      mp : grow(base.mp,  baseWhite.mp),
    };

    const newId = makeEquipInstance(inst.name, next, inst.slot, inst.weapon || null, newStats);
    addInv(newId, 1);

    say(
      `⚗️ 合成成功！獲得 ${fmtQual(next,qualName(inst.name,next))}` +
      `（ATK ${base.atk}→${newStats.atk}｜DEF ${base.def}→${newStats.def}` +
      `｜HP ${base.hp}→${newStats.hp}｜MP ${base.mp}→${newStats.mp}）`
    );

    // 重新計算一次角色能力（避免因為拆裝而沒更新）
    recomputeStats(false);
    renderInventoryList();
    render();
    return newId;   // ⬅ 只加這一行
  }

  // 強化
  let enhTargetId = null;
  const enhDlg = $("#enhDlg"),
        enhInfo = $("#enhInfo"),
        enhBtnDo = $("#enhBtnDo"),
        enhBtnCombine = $("#enhBtnCombine");

  $("#slot-weapon").onclick = ()=>openEnhForSlot("weapon");
  $("#slot-armor").onclick  = ()=>openEnhForSlot("armor");
  $("#slot-acc").onclick    = ()=>openEnhForSlot("acc");

  function openEnhForSlot(slot){
    const id=game.player.equip[slot];
    if(!id){ say("此槽位尚未裝備。"); return; }
    enhTargetId=id; renderEnhancePanel(); enhDlg.showModal();
  }
//坐騎裝備欄開窗
// [MOUNT-UI] 坐騎資訊面板
const mountDlg   = $("#mountDlg");
const mountInfo  = $("#mountInfo");
const closeMount = $("#closeMount");

// 點擊坐騎槽位 → 開啟坐騎資訊
$("#slot-mount").onclick = ()=> openMountPanel();

function openMountPanel(){
  const id = game.player.equip.mount;
  if(!id){
    say("尚未裝備坐騎。");
    return;
  }
  // 嘗試取出坐騎實例（若重整後失聯，走救援還原）
  let m = getMountInstance(id);
  if(!m && typeof tryRestoreMountFromSave === "function"){
    m = tryRestoreMountFromSave(id);
  }
  if(!m){
    say("坐騎資料遺失。");
    return;
  }

  // 取原始定義（拿描述 desc 用，不影響實例數值）
  const tpl = (typeof MOUNTS !== "undefined") ? (MOUNTS[m.name] || {}) : {};
  const statText = formatStatSummary(m, {delimiter:"｜"});

  // 排版：沿用你的 .stats/.stat 風格
  mountInfo.innerHTML = `
    <div class="row" style="align-items:center;gap:8px">
      <div style="font-weight:700">${m.name}</div>
      <span class="tag">移動效率 SPD：${m.spd || 0}</span>
    </div>
    <div class="hint" style="margin:6px 0 10px 0">描述：${tpl.desc || "—"}</div>
    <div class="stats" style="margin-top:4px">
      <div class="stat">${statText}</div>
    </div>
  `;
  mountDlg.showModal();
}

closeMount.onclick = ()=> mountDlg.close();
//坐騎裝備欄開窗
  
function renderEnhancePanel(){
  enhInfo.innerHTML = "";

  const inst = getEquipInstance(enhTargetId);
  if(!inst){
    enhInfo.innerHTML = "<div class='row'>找不到裝備。</div>";
    if(enhBtnDo) enhBtnDo.disabled = true;
    if(enhBtnCombine) enhBtnCombine.disabled = true;
    return;
  }

  const q = inst.qual || "白";
  const canEnh = QUALITY_ORDER[q] >= QUALITY_ORDER["藍"];
  const chance = enhChance(inst);
  const cost   = enhCost(inst);

  const line = document.createElement("div");
  line.className = "row";
  const statText = formatStatSummary(inst, {delimiter:" ｜"});
  line.innerHTML = `<div>
    ${displayEquipName(enhTargetId)}｜${qualWithStars(inst)}｜
    ${statText}
    <br><span class="tag affix">${affixShort(inst)}</span>
    <br><span class="tag">強化成功率：${Math.round(chance*100)}%｜費用：${cost} G</span>
  </div>`;

  enhInfo.appendChild(line);

  if(inst.name && inst.name.startsWith("[神器_")){
    const tip = document.createElement("div");
    tip.className = "hint";
    tip.innerHTML = "（神器強化：每+1 ATK+25 DEF+15 HP+80 MP+50；成功率可被「ㄅㄅㄐ之錘」加成）";
    enhInfo.appendChild(tip);
  }

  // 強化按鈕：只有藍品以上可以強化
  if(enhBtnDo) enhBtnDo.disabled = !canEnh;

  // 合成按鈕：白 / 綠 才可以，且需要至少 3 件（含身上）
  if(enhBtnCombine){
    let canCombine = QUALITY_ORDER[q] < QUALITY_ORDER["藍"];

    if(canCombine){
      let cnt = 0;

      // 背包
      Object.entries(game.inv).forEach(([k,v])=>{
        const eq = getEquipInstance(k);
        if(eq && eq.name === inst.name && eq.qual === inst.qual){
          cnt += v;
        }
      });

      // 身上
      ["weapon","armor","acc"].forEach(slot=>{
        const eid = game.player.equip[slot];
        if(!eid) return;
        const eq = getEquipInstance(eid);
        if(eq && eq.name === inst.name && eq.qual === inst.qual){
          cnt += 1;
        }
      });

      canCombine = cnt >= 3;
    }

    enhBtnCombine.disabled = !canCombine;
  }
}

  function applyStatDelta(inst, delta={}, sign=1){
    STAT_ORDER.forEach(k=>{
      if(typeof delta[k] === "number"){
        inst[k] = (inst[k] || 0) + delta[k] * sign;
      }
    });
  }


  // 成功率表（藍 / 黃 / 橘）
function enhChance(inst){
  const p = inst.plus || 0;
  const q = inst.qual || "";
  const s = inst.stars || 0;

  // 紫色：用你原本的 ENH_RATE.紫
  if(q === "紫"){
    return ENH_RATE.紫(p, s);
  }

  // 神器 & 神器☆：用你原本的 ENH_RATE.神器
  if(q === "神器" || q.startsWith("神器")){
    return ENH_RATE.神器(p, s);
  }

  // 藍 / 黃 / 橘：用你原本的 ENH_RATE.藍/黃/橘
  if(q === "藍" || q === "黃" || q === "橘"){
    return ENH_RATE[q](p);
  }

  // 白 / 綠 不可強化
  return 0;
}

function failDropChance(inst){
  const q = inst.qual;
  if(q==="藍") return 0; // 不掉
  if(q==="黃") return 0.20;
  if(q==="橘") return 0.30;
  if(q==="紫"){
    const s = inst.stars||0;
    return (s===0?0.40 : [0.45,0.50,0.55,0.60,0.65][Math.min(s,5)-1]);
  }
  return 0;
}

  /* 失敗降階機率
  function failDropChance(qual){
    if(qual==="藍") return 0.50;
    if(qual==="黃") return 0.65;
    if(qual==="橘") return 0.75;
    if(qual === "神器") return 0.85;   // ★ 新增：神器失敗多半會掉階
    return 1.0;
  }*/
  //強化費用
function enhCost(inst){
  const p = inst.plus || 0;       // +0～+9
  const s = inst.stars || 0;      // ☆0～5
  const q = inst.qual || "";      // 品質

  // 品質基礎價格
  const tierCost = {
    藍:200,
    黃:500,
    橘:1200,
    紫:3000,
    神器:4000   // ← 神器改成依品質判斷，不看名字
  };

  // 若找不到 → base=0（白／綠不可強化會被外層擋掉）
  const base = tierCost[q] || 0;

  // 星數倍率：每 1☆ 多 +0.5 倍
  const starMul = 1 + 0.5 * s;

  // 強化費用： (base + plus*100) * 星數倍率
  return Math.round((base + p * 100) * starMul);
}


enhBtnDo.onclick=()=>{
  const inst = getEquipInstance(enhTargetId);
  if(!inst) return;

  const cost = enhCost(inst);
  if(game.player.gold < cost){
    say("金幣不足。");
    return;
  }

// 神器規則另外處理
if(inst.qual && inst.qual.startsWith("神器")){
  const p = inst.plus || 0;
  const s = inst.stars || 0;
  const rate = ENH_RATE.神器(p, s);

  game.player.gold -= cost;

  if(Math.random() < rate){
    // 成功：+1 並加屬性
    inst.plus = p + 1;
    const d = PLUS_DELTA.神器;
    if(d){
      applyStatDelta(inst, d, 1);
    }

    if(inst.plus >= 10){
      inst.stars = Math.min(5, s + 1);
      inst.plus  = 0;
      say(`🟥 神器升星成功 → ${inst.stars}☆！`);
    }else{
      say(`🟥 神器強化成功：+${inst.plus}`);
    }
    }else{
    const fb = FAIL_BEHAVIOR.神器(s);
    if(Math.random() < fb.rate){
      // 有機會掉階：+ 等級下降，同時扣回對應的屬性
      if(p > 0){
        inst.plus = p - 1;

        const d = PLUS_DELTA.神器;
        if(d){
          applyStatDelta(inst, d, -1);
        }

        say(`❌ 神器強化失敗，降為 +${inst.plus}`);
      }else{
        // 已經是 +0 就只提示，不再扣
        say("❌ 神器強化失敗，但已是 +0。");
      }
    }else{
      // 保級：什麼都不變
      say("❌ 神器強化失敗（保級）。");
    }
  }

  // 🔻 不論成功 / 失敗，都把 ㄅㄅㄐ  buff 清掉
  if(!game.buffs) game.buffs = {xpLayers:[], artiHammer:0};
  game.buffs.artiHammer = 0;

  recomputeStats(false);
  renderEnhancePanel();
  render();
  autosave();
  return;
}


  // 🟦 其他品質：只能強化 藍 / 黃 / 橘 / 紫
  if(!["藍","黃","橘","紫"].includes(inst.qual)){
    say("此品階不可強化。");
    return;
  }

  game.player.gold -= cost;
  const ch = enhChance(inst);
  if(Math.random() < ch){
    // 成功：+1 並加屬性
    inst.plus = (inst.plus || 0) + 1;
    const delta = PLUS_DELTA[inst.qual];
    applyStatDelta(inst, delta, 1);

    if(inst.plus >= 10){
      const progress = onReachPlusTen(inst); // 升階或升星
      if(progress) say(`🌈 ${progress}！`);
    } else {
      say(`✅ 強化成功：<b>+${inst.plus}</b>（${inst.qual}）`);
    }
    recomputeStats(false);
  }else{
    // 失敗：依規則是否掉階
    const beforePlus = inst.plus || 0;
    const dropP = failDropChance(inst);
    if (beforePlus > 0 && Math.random() < dropP) {
      inst.plus = beforePlus - 1;
      const d = PLUS_DELTA[inst.qual];
      if (d) {
        applyStatDelta(inst, d, -1);
      }
      say(`❌ 強化失敗，降為 +${inst.plus}。`);
    } else {
      say(`❌ 強化失敗，但等級不變（保底）。`);
    }
    recomputeStats(false);
  }
  renderEnhancePanel();
  render();
  autosave();
};

  if(enhBtnCombine){
  enhBtnCombine.onclick = ()=>{
    if(!enhTargetId) return;
    const inst = getEquipInstance(enhTargetId);
    if(!inst) return;

    const q = inst.qual || "白";
    // 藍以上就不允許用「合成」了，只能強化
    if(QUALITY_ORDER[q] >= QUALITY_ORDER["藍"]){
      say("已達合成上限（藍品以上請用強化）。");
      return;
    }

    const need = 3;              
    // 1) 先合成，拿到新裝備 id
    const newId = combineEquip(enhTargetId, need);
    if(!newId) return; // 合成失敗就不動

    // 2) 自動穿上新裝備（用你原本的 equipItem 邏輯）
    equipItem(newId);

    // 3) 更新強化目標，讓面板顯示新裝備
    enhTargetId = newId;
    renderEnhancePanel();
  };
}


  // 詞條追加
  function addRandomAffix(inst){
    // 避免重複同 key（可重複則移除此判斷）
    const candidates = AFFIX_LIB.filter(a=>!inst.affix.some(x=>x.key===a.key));
    if(candidates.length===0) return;
    const pick = candidates[rnd(0,candidates.length-1)];
    const val = rnd(pick.min, pick.max);
    inst.affix.push({key:pick.key,val});
  }
// ===========================================
// [PATCH] 批量抽詞綴：連續呼叫 addRandomAffix N 次
// 放置位置：建議貼在 addRandomAffix(inst) 定義「後面」
// ===========================================
function addRandomAffixN(inst, n){
  n = (n|0);
  if (n <= 0) return;

  if (typeof addRandomAffix === "function"){
    for (let i = 0; i < n; i++) addRandomAffix(inst);
    return;
  }

  // ---- 安全後備：萬一你的專案沒有定義 addRandomAffix() ----
  if (!inst.affixes) inst.affixes = [];
  const pool = Object.keys(window.AFFIX_LIB || {});
  for (let i = 0; i < n; i++){
    // 避免重複同 key 詞綴（依你的結構微調）
    const cand = pool.filter(k => !inst.affixes.some(a => a.key === k));
    if (!cand.length) break;

    const key = cand[Math.floor(Math.random() * cand.length)];
    const roll = (window.AFFIX_LIB || {})[key];
    let val = 1;

    if (typeof roll === "function") {
      // 若你的詞綴是函式型，給它 inst 讓它能依裝備狀態滾值
      val = roll(inst);
    } else if (roll && typeof roll.min === "number" && typeof roll.max === "number") {
      val = Math.floor(Math.random() * (roll.max - roll.min + 1)) + roll.min;
    }
    inst.affixes.push({ key, val });
  }
}



  
  // 傷害修飾
  function effectiveEnemyDef(e,p){
  if(!e) return 0;
  let def = e.def;

  // 技能造成的防禦下降（例如破甲斬 -80%）
  if(e.defDown && e.defDown > 0){
    def = Math.floor(def * (1 - e.defDown));
  }

  // 詞條「破甲」再額外 -20%
  const w = getEquippedWithAffix(p);
  if(w?.affix?.some(a=>a.key==="shred")){
    def = Math.floor(def * 0.8);
  }

  if(p?.defPierce){
    def = Math.max(0, def - Math.floor(p.defPierce));
  }

  return Math.max(0, def);
}

  function getEquippedWithAffix(p){
    const ids=[p.equip.weapon,p.equip.armor,p.equip.acc].filter(Boolean);
    for(const id of ids){ const inst=getEquipInstance(id); if(inst && inst.affix && inst.affix.length) return inst; }
    return null;
  }
  function calcSkillCost(p, base){
    const reduce = Math.min(0.5, p?.skillCostReduce || 0);
    return Math.max(1, Math.floor(base * (1 - reduce)));
  }
  function applySpeedBonus(p, base){
    const haste = (p?.actionSpeedBonus || 0) + berserkerActionSpeedBonus();
    return Math.max(1, Math.floor(base * (1 + haste)));
  }
  function recoverManaOnAction(p){
    const regen = Math.floor(p?.manaRegen || 0);
    if(regen>0){
      p.mp = clamp(p.mp + regen, 0, p.maxmp);
    }
  }
  function critMaybe(p,base,type="physical"){
    const w = getEquippedWithAffix(p);
    const baseRate = type === "magic" ? (p?.magicCritRate || 0) : (p?.physCritRate || 0);
    let critRate=baseRate;
    if(w?.affix?.some(a=>a.key==="crit")) critRate+=5;
    let critDmg = type === "magic" ? (p?.magicCritDmg || 1.8) : (p?.physCritDmg || 1.8);
    const howl = activeWildHowl();
    if(howl && type === "physical"){
      critRate += howl.critRate || 0;
      critDmg += howl.critDmg || 0;
    }
    const isCrit = Math.random()*100 < critRate;
    if(isCrit && p === game.player){
      gainWarInstinctStack(1);
    }
    return isCrit ? Math.floor(base*critDmg) : base;
  }
  function tryCombo(p,e){
    const w = getEquippedWithAffix(p);
    if(!w) return;

    // 有「連擊」詞條才觸發
    if(w.affix?.some(a => a.key === "combo")){
      // 觸發率從 25% 降到 15%，比較不逆天
      if(Math.random() * 100 < 15){
        const effDef = effectiveEnemyDef(e,p);
        let extra = Math.max(1, rnd(p.atk-2, p.atk+2) - effDef);

        // 降到約 7 成傷害，當作半顆被動技能
        extra = Math.floor(extra * 0.5);
        extra = critMaybe(p, extra);

        e.hp = clamp(e.hp - extra, 0, e.maxhp);
        say(`🔁 連擊觸發！追加傷害 <span class="hp">-${extra}</span>。`);
      }
    }
  }

   function affixOnHit(p,e,damage){
    // ✅ 沒有敵人就別處理詞條
    if(!e) return;
    const w = getEquippedWithAffix(p); 
    if(!w) return;

    w.affix.forEach(a=>{
      // 吸血：依「本次傷害」的 2~4%，且加上上限，避免一刀吸太多
      if(a.key === "lifesteal"){
        // 舊存檔如果以前是 5~10，這裡會被夾成 2~4，避免太超過
        const percent = Math.max(2, Math.min(a.val, 4)); // 2% ~ 4%
        let heal = Math.floor(damage * percent / 100);

        // 單次最多回 20% maxHP，順便避免一刀回滿
        const cap  = Math.floor(p.maxhp * 0.20);
        heal = Math.min(heal, cap, damage);

        if(heal > 0){
          p.hp = clamp(p.hp + heal, 0, p.maxhp);
          say(`🩸 吸血回復 <b>${heal} HP</b>。`);
        }
      }

      // 中毒：依「玩家攻擊力」的 10~18% 當成 DOT，至少 3 回合
      if(a.key === "poison"){
        // 舊存檔如果之前是 2~5，這裡會被拉高到至少 8%，不會太廢
        const percent = Math.max(8, Math.min(a.val, 18)); // 8% ~ 18%
        const dot = Math.max(1, Math.floor(p.atk * percent / 100));

        e.dot = dot;
        e.dotTurns = Math.max(3, e.dotTurns || 0); // 至少 3 回合
        say(`☠️ ${e.name} 中毒了，每回合將損失約 <b>${dot}</b> HP（${e.dotTurns} 回合）。`);
      }
    });
  }


    /* ========= 商店 ========= */

  const shopDlg = $("#shopDlg"),
        buyList = $("#shopBuyList"),
        sellList = $("#shopSellList");
  // HTML 裡已經拿掉 restockBtn，但這裡保留變數，不會壞（是 null）
  const restockBtn = $("#restockBtn");

  // 商店目前的顯示分類（all / weapon / equip / consum / mount / enh）
  let shopCategory = "all";

  // 開啟商店：只要初始化一次商品清單即可，之後不限制庫存
  function openShop(){
    if(game.state.inBattle) return say("戰鬥中無法逛街！");
    ensureStock();
    renderShop();
    shopDlg.showModal();
  }

  // 只把 shopCatalog 複製成固定清單，不再有 qty / 補貨
  function ensureStock(){
    if(!game.shop.stock || game.shop.stock.length === 0){
      game.shop.stock = shopCatalog.map(x => ({
        name:  x.name,
        type:  x.type,   // weapon / equip / consum / mount / 之後也可以加 enh
        price: x.price
      }));
    }
  }

  // 依分類判斷要不要顯示
  function itemSlot(name){
    return EQUIPS[name]?.slot;
  }

  function isWeaponItem(s){
    const slot = itemSlot(s.name);
    if(slot === "weapon") return true;
    return s.type === "weapon";
  }

  function isEquipItem(s){
    const slot = itemSlot(s.name);
    if(slot === "armor" || slot === "acc") return true; // armor / acc
    if(slot === "weapon") return false;
    return s.type === "equip";
  }

  function matchShopCategory(s, cat){
    if(cat === "all") return true;

    if(cat === "weapon") return isWeaponItem(s);
    if(cat === "equip")  return isEquipItem(s);
    if(cat === "consum") return s.type === "consum";
    if(cat === "mount")  return s.type === "mount";

    // 強化道具：預留給之後 type === "enh" 或名稱含關鍵字都可以
    if(cat === "enh"){
      return s.type === "enh" || /錘|鎚|強化|神器碎片/.test(s.name);
    }
    return true;
  }

  function renderShop(){
    $("#shopGold").textContent = game.player.gold;
    buyList.innerHTML = "";

    // 依目前分類篩選
    const list = (game.shop.stock || []).filter(s => matchShopCategory(s, shopCategory));

    if(list.length === 0){
      buyList.innerHTML = `<div class="row"><span class="muted">目前沒有此分類的商品。</span></div>`;
    }else{
      list.forEach(s=>{
        const row = document.createElement("div");
        row.className = "row";

        let desc = "";
        if(s.type === "equip" || s.type === "weapon"){
          const tpl = EQUIPS[s.name];
          if(tpl){
            const req = equipRestrictionText(tpl);
            const slot = itemSlot(s.name);
            const kind = slot === "weapon" ? "武器" : (slot === "armor" ? "防具" : (slot === "acc" ? "飾品" : "裝備"));
            desc = `｜${kind}｜白品｜${formatStatSummary(tpl, {delimiter:"｜"})}｜${req}`;
          }else{
            const kind = isWeaponItem(s)?"武器":"裝備";
            desc = `｜${kind}`;
          }
        }
        if(s.type === "mount"){
          const tpl = MOUNTS[s.name] || {};
          desc = `｜坐騎｜${formatStatSummary(tpl, {delimiter:"｜"})}｜SPD ${tpl.spd||0}`;
        }
        if(s.type === "consum"){
          desc = `｜消耗品${s.name==="經驗加倍捲"?"（5 日加倍，可疊加）":""}`;
        }
        if(s.type === "enh" && !desc){
          desc = "｜強化道具";
        }

        row.innerHTML = `
          <div>
            <b>${s.name}</b>
            <span class="tag">${desc}</span><br>
            <span class="tag">價格：${s.price}G（庫存不限）</span>
          </div>
        `;

        const buyBtn = btn("購買", ()=>buyFromShop(s));
        row.appendChild(buyBtn);
        buyList.appendChild(row);
      });
    }

    renderSellList();
  }

  // ✅ 購買時可以輸入數量，不再限制庫存
  function buyFromShop(s){
    const price = s.price || 0;

    let q = prompt(`要購買多少個「${s.name}」？`, "1");
    if(q === null) return;        // 取消
    q = parseInt(q, 10);
    if(!Number.isFinite(q) || q <= 0){
      alert("數量要是正整數喔。");
      return;
    }

    // 批量購買上限 200，避免一次買太多把錢花光
    const MAX_BULK = 200;
    if(q > MAX_BULK){
      alert(`一次最多購買 ${MAX_BULK} 個，已自動調整為 ${MAX_BULK}。`);
      q = MAX_BULK;
    }

    // 坐騎通常只需要 1 個，這裡限制為 1
    if(s.type === "mount"){
      q = 1;
    }

    const total = price * q;
    if(game.player.gold < total){
      alert("金幣不足");
      return;
    }

    game.player.gold -= total;

    if(s.type === "consum"){
      addInv(s.name, q);
      say(`🛒 買下 <b>${s.name}</b> ×${q}（-${total}G）。`);
    }else if(s.type === "equip" || s.type === "weapon"){
      for(let i=0;i<q;i++) addEquipToInv(s.name,"白");
      say(`🛒 買下 <b>${s.name}</b> ×${q}（-${total}G）。`);
    }else if(s.type === "mount"){
      addMountToInv(s.name);
      say(`🛒 買下坐騎 <b>${s.name}</b>（-${total}G）。`);
    }else if(s.type === "enh"){
      addInv(s.name, q);
      say(`🛒 買下 <b>${s.name}</b> ×${q}（-${total}G）。`);
    }

    $("#shopGold").textContent = game.player.gold;
    render();
    renderShop();
  }

  // ====== 販售（支援輸入數量＋一鍵賣出） ======

  function renderSellList(){
    sellList.innerHTML = "";
    const entries = Object.entries(game.inv);
    if(entries.length === 0){
      sellList.innerHTML = `<div class="row"><span class="muted">沒有可販售的物品。</span></div>`;
      return;
    }

    entries.forEach(([name,count])=>{
      if(count <= 0) return;

      const price = sellPrice(name);
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<div><b>${displayInvName(name)}</b> × ${count} <span class="tag">— 單價 ${price}G</span></div>`;

      // 1 個、輸入數量、全部賣出
      row.append(
        btn("賣出 1 個", ()=>sellItem(name,1,price)),
        btn("輸入數量", ()=>{
          let q = prompt(`要賣出多少個「${displayInvName(name)}」？（最多 ${count}）`, String(count));
          if(q === null) return;
          q = parseInt(q,10);
          if(!Number.isFinite(q) || q <= 0){
            alert("數量要是正整數喔。");
            return;
          }
          q = Math.min(q, count);
          sellItem(name,q,price);
        }),
        btn("全部賣出", ()=>sellItem(name,count,price))
      );

      sellList.appendChild(row);
    });
  }

  function sellPrice(name){
    // 🧩 神器碎片：固定售價 500G
    if(name.includes("神器碎片")) return 500;

    const meta = invMeta(name);
    if(meta.type === "consum"){
      return Math.max(1, Math.floor((shopCatalog.find(x=>x.name===name)?.price || 4) * 0.5));
    }
    if(meta.type === "mount"){
      return 5000;
    }
    if(meta.type === "equip"){
      const eq = getEquipInstance(name);
      if(!eq) return 5;
      const affixScore = (eq.affix || []).length * 20;
      const base = 20 + QUALITY_ORDER[eq.qual] * 40 + (eq.plus || 0) * 10 + affixScore;
      return Math.max(5, base);
    }
    if(meta.type === "book"){
      return 8;
    }
    return 1;
  }

  function sellItem(name, cnt, price){
    const real = Math.min(cnt, game.inv[name] || 0);
    if(real <= 0) return;
    decInv(name, real);
    const got = real * price;
    game.player.gold += got;
    say(`💰 賣出 <b>${displayInvName(name)}</b> ×${real}，獲得 <b>${got}G</b>。`);
    render();
    renderSellList();
    $("#shopGold").textContent = game.player.gold;
  }

  function sellSingle(name){
    sellItem(name, 1, sellPrice(name));
    renderInventoryList();
  }

  // 一鍵賣出：依照下拉選單設定的條件批量處理
  function bulkSellByFilter(mode){
    if(!mode || mode === "none") return;

    let totalGold = 0;
    let totalCount = 0;

    for(const [name, count] of Object.entries(game.inv)){
      if(count <= 0) continue;
      if(!matchBulkSell(name, mode)) continue;

      const price = sellPrice(name);
      const real = count;
      decInv(name, real);
      const got = real * price;
      totalGold += got;
      totalCount += real;
    }

    if(totalCount > 0){
      game.player.gold += totalGold;
      say(`💰 一鍵賣出 ${totalCount} 件物品，獲得 <b>${totalGold}G</b>。`);
      render();
      renderSellList();
      $("#shopGold").textContent = game.player.gold;
    }else{
      say("沒有符合條件的物品可賣出。");
    }
  }

  // 判斷某個物品是否符合一鍵賣出的條件
  function matchBulkSell(name, mode){
    const meta = invMeta(name);

    if(mode === "consum"){
      return meta.type === "consum";
    }

    if(mode.endsWith("Equip")){
      if(meta.type !== "equip") return false;
      const inst = getEquipInstance(name);
      if(!inst) return false;

      if(mode === "whiteEquip") return inst.qual === "白";
      if(mode === "greenEquip") return inst.qual === "綠";
      if(mode === "blueEquip")  return inst.qual === "藍";
    }

    return false;
  }
  // 🔧 補貨按鈕：HTML 已經拿掉，這裡留著不做事（保留舊存檔相容性）
  if(restockBtn){
    restockBtn.onclick = ()=>{
      // 不再補貨，只提示一次
      alert("現在商店庫存不限，不需要補貨囉。");
    };
  }
  /* ========= 任務 ========= */  
  // 依等級解鎖可接受任務（從 locked → available）
  function refreshQuestsForLevel(lvl){
    if(!Array.isArray(game.quests)) return;
    game.quests.forEach(q=>{
      const need = q.minLvl || 1;
      if(q.state === "locked" && lvl >= need){
        q.state = "available";
      }
    });
  }

  // 計算指定品質裝備數量（綠 / 藍）
  function countEquipsByQuality(qual){
    let cnt = 0;
    for(const [k,v] of Object.entries(game.inv)){
      if(!k.startsWith("E#") || v<=0) continue;
      const inst = getEquipInstance(k);
      if(inst && inst.qual === qual){
        cnt += v;
      }
    }
    return cnt;
  }

  // 由背包中扣除指定品質裝備（用於任務提交）
  function removeEquipsByQuality(qual, need){
    if(need <= 0) return true;
    const toRemove = [];
    for(const [k,v] of Object.entries(game.inv)){
      if(!k.startsWith("E#") || v<=0) continue;
      const inst = getEquipInstance(k);
      if(!inst || inst.qual !== qual) continue;
      const use = Math.min(v, need);
      if(use > 0){
        toRemove.push([k, use]);
        need -= use;
        if(need <= 0) break;
      }
    }
    if(need > 0) return false;
    toRemove.forEach(([k,c])=>decInv(k,c));
    return true;
  }

  function findQuestDef(id){
    return QUEST_DB.find(d=>d.id === id);
  }

  // 將任務獎勵物件轉成可閱讀字串
  function formatQuestReward(r){
    if(!r) return "無";
    const parts = [];
    if(r.exp)  parts.push(`EXP ${r.exp}`);
    if(r.gold) parts.push(`${r.gold} G`);
    if(r.item){
      const c = r.itemCount || 1;
      parts.push(`${r.item} ×${c}`);
    }
    if(r.items){
      for(const [name,c] of Object.entries(r.items)){
        parts.push(`${name} ×${c}`);
      }
    }
    return parts.join("、");
  }  
// ✅ 遊戲載入或需要時檢查：如果所有任務都已領獎，就刷新一輪
function refreshQuestsIfAllRewarded(){
  const qs = Array.isArray(game.quests) ? game.quests : [];
  if(qs.length === 0) return; // 沒任務就先不管，通常 init 會自己 seed

  const allRewarded = qs.every(q => q.state === "rewarded");
  if(allRewarded){
    say("📜 檢測到所有任務都已完成，已刷新新一輪任務！");
    seedQuests();
    renderQuestList();
    autosave();
  }
}  
  function renderQuestList(){
    const box = $("#questList");
    box.innerHTML = "";
    if(!Array.isArray(game.quests) || game.quests.length === 0){
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = "<div>目前沒有任務。</div>";
      box.appendChild(row);
      return;
    }
    game.quests.forEach(q=>{
      const row = document.createElement("div");
      row.className = "row";

      let st;
      switch(q.state){
        case "done":      st = "✅ 可領取"; break;
        case "active":    st = "🟡 進行中"; break;
        case "rewarded":  st = "✔ 已完成"; break;
        case "available": st = "📜 可接受"; break;
        default:          st = "🔒 未解鎖"; break;
      }
      const needSubmitBtn = (q.state === "active") &&
        (q.req?.submitItems || q.req?.submitEquip);

            row.innerHTML = `
        <div>
          <b>${q.name}</b> <span class="tag">${st}</span><br>
          <span class="muted">${q.desc}</span><br>
          <span class="tag">${formatQuestProgress(q)}</span><br>
          <span class="tag">獎勵：${formatQuestReward(q.reward)}</span><br>
          ${q.state === "available"
            ? `<button class="btn tiny" data-act="accept" data-qid="${q.id}">接受</button>`
            : ""}
          ${needSubmitBtn
            ? `<button class="btn tiny" data-act="submit" data-qid="${q.id}">提交</button>`
            : ""}
          ${q.state === "done"
            ? `<button class="btn tiny" data-act="reward" data-qid="${q.id}">領取獎勵</button>`
            : ""}
        </div>
      `;
      row.onclick = (ev)=>{
        const btn = ev.target.closest("button[data-act]");
        if(!btn) return;
        const act = btn.dataset.act;
        const id  = btn.dataset.qid;
        const qq  = game.quests.find(x=>x.id === id);
        if(!qq) return;
        if(act === "accept")      acceptQuest(qq);
        else if(act === "submit") trySubmitQuest(qq);
        else if(act === "reward") claimQuestReward(qq);
        renderQuestList();
        autosave();
      };
      box.appendChild(row);
    });
  }

  function formatQuestProgress(q){
    const req = q.req || {};
    // 擊殺任意怪物
    if(req.killAny){
      const cur = q.progress?.killAny || 0;
      return `擊敗任意怪物：${cur} / ${req.killAny}`;
    }
    // 提交指定道具
    if(req.submitItems){
      const parts = [];
      for(const [name,need] of Object.entries(req.submitItems)){
        const have = game.inv[name] || 0;
        parts.push(`${name}：${have} / ${need}`);
      }
      return "提交道具：" + parts.join("，");
    }
    // 提交指定品質裝備
    if(req.submitEquip){
      const parts = [];
      if(req.submitEquip.green){
        const g = countEquipsByQuality("綠");
        parts.push(`綠裝：${g} / ${req.submitEquip.green}`);
      }
      if(req.submitEquip.blue){
        const b = countEquipsByQuality("藍");
        parts.push(`藍裝：${b} / ${req.submitEquip.blue}`);
      }
      return "提交裝備：" + parts.join("，");
    }
    return "—";
  }
  function acceptQuest(q){
    if(q.state !== "available") return;
    q.state = "active";
    if(!q.progress) q.progress = {};
    say(`📜 接受任務：<b>${q.name}</b>`);
  }
  function trySubmitQuest(q){
    if(q.state !== "active") return;
    const req = q.req || {};

    // 提交道具
    if(req.submitItems){
      for(const [name,need] of Object.entries(req.submitItems)){
        const have = game.inv[name] || 0;
        if(have < need){
          say(`❌ ${name} 不足，還需要 ${need - have} 瓶。`);
          return;
        }
      }
      // 扣除
      for(const [name,need] of Object.entries(req.submitItems)){
        decInv(name, need);
      }
      q.state = "done";
      say(`📦 你已提交任務道具，<b>${q.name}</b> 已可領取獎勵。`);
      return;
    }

    // 提交裝備
    if(req.submitEquip){
      if(req.submitEquip.green){
        const okG = removeEquipsByQuality("綠", req.submitEquip.green);
        if(!okG){
          const cur = countEquipsByQuality("綠");
          say(`❌ 綠裝不足，還需要 ${req.submitEquip.green - cur} 件。`);
          return;
        }
      }
      if(req.submitEquip.blue){
        const okB = removeEquipsByQuality("藍", req.submitEquip.blue);
        if(!okB){
          const cur = countEquipsByQuality("藍");
          say(`❌ 藍裝不足，還需要 ${req.submitEquip.blue - cur} 件。`);
          return;
        }
      }
      q.state = "done";
      say(`📦 你已提交裝備，<b>${q.name}</b> 已可領取獎勵。`);
    }
  }
 function claimQuestReward(q){
    if(q.state !== "done") return;

    // 發放獎勵
    grantReward(q.reward);
    q.state = "rewarded";

    // 顯示這次任務的獎勵內容
    const text = formatQuestReward(q.reward);
    say(`🎉 任務完成：<b>${q.name}</b>！獲得獎勵：<b>${text}</b>`);

    // 🌟 檢查是否所有任務已領獎，如果是就刷新
    refreshQuestsIfAllRewarded();
  }
  // 擊殺任意怪物的進度更新
  function updateQuestProgressOnKill(name){
    if(!Array.isArray(game.quests)) return;
    game.quests.forEach(q=>{
      if(q.state !== "active") return;
      const req = q.req || {};
      if(req.killAny){
        if(!q.progress) q.progress = {};
        const cur = q.progress.killAny || 0;
        q.progress.killAny = cur + 1;
        if(q.progress.killAny >= req.killAny){
          q.state = "done";
          say(`📜 任務完成：<b>${q.name}</b>！請回任務欄領取獎勵。`);
        }
      }
    });
  }

  // 目前只給 killAny 任務用；預留未來擴充
  function checkQuestDone(q){
    const req = q.req || {};
    if(req.killAny){
      const cur = q.progress?.killAny || 0;
      if(cur >= req.killAny){
        q.state = "done";
      }
    }
  }

  function grantReward(r){
    if(!r) return;
    if(r.exp)  gainExp(r.exp);
    if(r.gold) game.player.gold += r.gold;

    // 單一物品
    if(r.item){
      const c = r.itemCount || 1;
      addInv(r.item, c);
      say(`🎁 獲得 ${r.item} ×${c}`);
    }

    // 多個物品
    if(r.items){
      for(const [name,c] of Object.entries(r.items)){
        addInv(name, c);
        say(`🎁 獲得 ${name} ×${c}`);
      }
    }
    render();
    autosave();
  }

  /* ========= 轉職 ========= */
  function ensureClassNoticeFlags(){
    if(!game.uiFlags) game.uiFlags = { classNotice:{} };
    if(!game.uiFlags.classNotice) game.uiFlags.classNotice = {};
  }

  function showClassUnlockNotice(req, tier){
    ensureClassNoticeFlags();
    if(game.uiFlags.classNotice[tier]) return;

    game.uiFlags.classNotice[tier] = true;
    say("🏷️ 你感受到職業之力在共鳴，<b>可以轉職</b>了！");
    if(classNoticeText) classNoticeText.textContent = `達到 Lv.${req}，可以進行第 ${tier+1} 次轉職！`;
    if(classNoticeDlg) classNoticeDlg.showModal();
    autosave();
  }

 function checkUnlocks(){
  const p=game.player; const t=p.tier||0; const nextReq=CLASS_REQ[t];
  if(nextReq && p.lvl>=nextReq){
    $("#classBtn").disabled=false;
    showClassUnlockNotice(nextReq, t);
  }
  // ★ 200 等解鎖轉生
  if(p.lvl >= 200){
    $("#rebirthBtn").disabled = false;
    // 可避免一直刷訊息：只在從未開啟→開啟的瞬間提示
    if(!checkUnlocks.__tipped){
      say("♻️ 你的靈魂在顫動，<b>可以轉生</b>了！");
      checkUnlocks.__tipped = true;
    }
  }
}

  function openClass(){
    const p=game.player, t=p.tier||0, nextReq=CLASS_REQ[t];
    const list=$("#classList"); list.innerHTML="";
    if(!nextReq){ $("#classHint").textContent="已達最高轉職段。"; }
    else if(p.lvl<nextReq){ $("#classHint").textContent=`需要 Lv.${nextReq} 才能進行下一次轉職。`; }
    else{
      $("#classHint").textContent="選擇你的道路（一次性，每段一次）。";
      const candidates = classCandidatesForTier(t+1);
      candidates.forEach(c=>{
        const row=document.createElement("div"); row.className="row";
        row.innerHTML=`<div><b>${c.name}</b> <span class="tag">— 轉職後可習得：${c.start.map(id=>SKILL[id].name).join("、")}｜武器：${(JOB_WEAPON[c.key]||[]).join("/")}</span></div>`;
        row.appendChild(btn("選擇",()=>chooseClass(c.key))); list.appendChild(row);
      });
    }
    classDlg.showModal();
  }
  function classCandidatesForTier(tier){
    if(tier===1) return JOB_TREE.filter(j=>j.parent==="Novice");
    const cur = JOB_TREE.find(j=>j.key===game.player.job);
    if(!cur) return [];
    return JOB_TREE.filter(j=>j.parent===cur.key);
  }
  function chooseClass(key){
  const p=game.player, t=p.tier||0, need=CLASS_REQ[t];
  if(!need){ return say("已無更高轉職。"); }
  if(p.lvl<need){ return say(`❌ 需要 Lv.${need} 才能轉職。`); }

  const cls=JOB_TREE.find(j=>j.key===key);
  if(!cls) return;

  // ① 保留轉職前 HP/MP 百分比
  const hpRatio = Math.max(0, Math.min(1, p.hp / Math.max(1, p.maxhp)));
  const mpRatio = Math.max(0, Math.min(1, p.mp / Math.max(1, p.maxmp)));

  // ② 不重置數值模板；僅切換職業/段數，並把起始技能標記為待習得
  p.job = key;
  p.tier = t + 1;
  cls.start.forEach(id=>{ if(!(id in p.learned)) p.learned[id]=0; });

  // 清除舊版紀錄的轉職倍率（已取消）
  if (p.jobBonus) delete p.jobBonus;

  // ③ 重新計算，並依比例恢復血魔（不再額外給轉職倍率）
  recomputeStats(false);
  p.hp = clamp(Math.floor(p.maxhp * hpRatio), 1, p.maxhp);
  p.mp = clamp(Math.floor(p.maxmp * mpRatio), 0, p.maxmp);

  say(`🏷️ 你成為了 <b>${cls.name}</b>！新職業技能已解鎖，使用技能點數即可學習。`);
  $("#classBtn").disabled=true;
  classDlg.close();
  render(); autosave();
}

  /* ========= 掛機 ========= */
  let afkTimer=null;
  function toggleAFK(){
    game.player.afk=!game.player.afk;
    $("#afkBtn").textContent = game.player.afk? "🤖 掛機：開" : "🤖 掛機：關";
    if(game.player.afk){
      if(afkTimer) clearInterval(afkTimer);
      afkTimer=setInterval(()=>afkTick(), 1000);
      say("🤖 掛機已開啟。");
    }else{
      if(afkTimer) clearInterval(afkTimer), afkTimer=null;
      say("🛑 掛機已關閉。");
    }
  }
// [FIX] 掛機主迴圈：不在戰鬥時要主動探索；在戰鬥時才打與判定
function afkTick(){
  const st = game.state;

  // [FIX] 安全善後：旗標與敵人不同步時，結束戰鬥避免技能空放
  if(st.inBattle && (!st.enemy || st.enemy.hp <= 0)){
    endBattle(true);
    return;
  }

  // [FIX] 不在戰鬥 → 立刻探索以觸發新戰鬥
  if(!st.inBattle){
    explore();
    return;
  }

  // 執行到這裡代表「正在戰鬥」且有敵人
  const p = game.player;
  const e = st.enemy;
  if(!e){ 
    // 理論上不會到這，但保險
    endBattle(false);
    return;
  }

   // ✅ 自動用藥（支援小/中/大/特級）與回魔
  if( autoUseHeal() ) return;
  if( autoUseMana() ) return;

  // ✅ 自動釋放主動技能：失敗時改用普通攻擊
  const usedSkill = useActiveSkill();   // 會回傳 true / false

  if(!usedSkill){
    // MP 不足 / 沒有技能可用 → 用普通攻擊頂上，避免掛機卡死
    playerAttack();
  }
  // ✅ 勝負判定
  if(st.enemy && st.enemy.hp <= 0){
    endBattle(true);
    return;
  }
}  
// ==========================
// ♻️ 轉生功能
// ==========================
function doRebirth(){
  const p = game.player;
  if(p.lvl < 200){ say("尚未達到 200 等，不能轉生。"); return; }
  if(game.state.inBattle){ say("戰鬥中不可轉生。"); return; }

  p.rebirths = (p.rebirths||0) + 1;
  p.lvl = 1;
  p.exp = 0;
  p.freeStatPoints = (p.freeStatPoints||0) + 2;

  game.state.inBattle = false;
  game.state.enemy = null;

  recalcPlayerStats();
  p.hp = p.maxhp;
  p.mp = p.maxmp;

  say(`♻️ <b>轉生成功！</b>（第 ${p.rebirths} 次）獲得額外屬性點 +2，其他數值已重置為新屬性公式。`);
  $("#rebirthBtn").disabled = true;
  rebirthDlg.close();
  render(); autosave();
}

  /* ========= 說明 ========= */
  function openHelp(){
    const box=$("#helpBox");
    box.innerHTML=`
      <b>功能總覽</b><br>
      • 網頁偽裝：按 Esc 先關對話框，再切換儀表板/報表模式，讓你上班免煩惱。<br>
      • 掛機：按「🤖 掛機」開關；每 1 秒自動探索/戰鬥，血/魔自動用藥。<br>
      • 地圖：每 10 等一張地圖，另設有BOSS地圖。<br>
      • 轉職：Lv10/30/70/120 四轉；轉職發放專屬技能。<br>
      • 商店：只賣白品裝備、消耗品與戰馬（10,000G）。<b>經驗加倍捲</b>（100G，5 日，可疊加）。<br>
      • 藥水：治療與魔力藥水皆可 2 合 1（小→中→大→特級）。特級：治療回 50% HP、魔力回 50% MP。<br>
      • 裝備品質：白/綠/藍/黃/橘/紫/神器（紅）；白→綠→藍可用合成（同名 3 件）。<br>
      • 強化：藍品以上可強化；成功率依品質與等級表；失敗時有機率 -1。+10升下一品質。<br>
      • 詞條：藍→黃、黃→橘時各追加 1 條詞條（吸血/中毒/爆擊/連擊/破甲）。<br>
      • 技能：基礎技能書怪物可掉；技能最高 25，滿級可升品質並重置。<br>
      • 經驗：每層加倍捲 = +100% EXP，可疊加，按「日數」遞減。死亡損失 50% EXP、20% 金幣。<br>
      • 任務：解任務可獲得[錢袋]來挑戰人品吧。<br>
      • Boss：5% 掉專屬坐騎；0.5% 掉 <span class="arti-name">[神器☆名稱]</span>（隨機屬性）。<br>
      <br>
      <b>怪物與掉落（當前地圖）</b><br>
      ${currentZone().pool.map(m=>`・${m.name}`).join("、")}<br>
    `;
    helpDlg.showModal();
  }

  /* ========= XP 加倍捲 ========= */
  function addXpBuff(days){ for(let i=0;i<1;i++) game.buffs.xpLayers.push(days); autosave(); } // 一次使用一層
  function activeXpBuffs(){ return game.buffs.xpLayers.filter(d=>d>0).length; }
  function advanceDay(n){
    for(let i=0;i<n;i++){
      game.state.day+=1;
      game.buffs.xpLayers = game.buffs.xpLayers.map(d=>Math.max(0,d-1));
    }
    const left = activeXpBuffs();
    say(`☀️ 日數推進至 Day ${game.state.day}（加倍層數 ${left}）`);
  }

  /* ========= 綁定 ========= */
  const mapDlg=$("#mapDlg"), classDlg=$("#classDlg"), questDlg=$("#questDlg"),
        shopClose1=$("#closeShop"), shopClose2=$("#closeShop2"),
        shopTabs=[...document.querySelectorAll("#shopDlg .tab")],
        shopCatBtns=[...document.querySelectorAll(".shopCatBtn")],
        bulkSellFilter=$("#bulkSellFilter"),
        bulkSellBtn=$("#bulkSellBtn"),
        helpDlg=$("#helpDlg");

  classNoticeDlg = $("#classNoticeDlg");
  classNoticeText = $("#classNoticeText");

  skillDlg = $("#skillDlg");
  const skillTabButtons=[...document.querySelectorAll('#skillTabs button')];


  $("#exploreBtn").onclick=explore;
  $("#restBtn").onclick=rest;
  $("#battleBtn").onclick=startBattle;
  $("#attackBtn").onclick=playerAttack;
  $("#skillBtn").onclick=useActiveSkill;
  $("#invBtn").onclick=()=>openInventory();
  $("#runBtn").onclick=tryRun;

$("#saveBtn").onclick = ()=>{
  autosave();
  say("💾 存檔成功！");
};
$("#resetBtn").onclick=()=>{ if(confirm("確定要重開？會清除存檔與商店庫存。")){ localStorage.removeItem(LKEY); location.reload(); } };
$("#questBtn").onclick=()=>{ renderQuestList(); questDlg.showModal(); };

 const rebirthDlg = $("#rebirthDlg");
const doRebirthBtn = $("#doRebirthBtn");
  $("#classBtn").onclick=()=>openClass();
  $("#shopBtn").onclick=()=>openShop();
  $("#mapBtn").onclick=()=>openMap();
  $("#skillBookBtn").onclick=()=>{ renderSkillList(); skillDlg.showModal(); };
  skillTabButtons.forEach(btn=>{
    btn.onclick=()=>{
      currentSkillTierTab = Number(btn.dataset.tier||0);
      renderSkillList();
    };
  });
  $("#helpBtn").onclick=()=>openHelp();
  $("#afkBtn").onclick=()=>toggleAFK();

  $("#closeInv").onclick=()=>invDlg.close();
  $("#closeQuest").onclick=()=>questDlg.close();
  $("#closeClass").onclick=()=>classDlg.close();
  $("#closeClassNotice").onclick=()=>{ if(classNoticeDlg) classNoticeDlg.close(); };
  $("#openClassNotice").onclick=()=>{ if(classNoticeDlg) classNoticeDlg.close(); openClass(); };
  $("#closeShop").onclick=()=>shopDlg.close();
  $("#closeShop2").onclick=()=>shopDlg.close();
  $("#closeMap").onclick=()=>mapDlg.close();
  $("#closeSkill").onclick=()=>skillDlg.close();
  $("#closeHelp").onclick=()=>helpDlg.close();
  $("#closeEnh").onclick=()=>enhDlg.close();
$("#rebirthBtn").onclick = ()=>{ rebirthDlg.showModal(); };
$("#closeRebirth").onclick = ()=>{ rebirthDlg.close(); };
doRebirthBtn.onclick = ()=>{ doRebirth(); };

  document.querySelectorAll(".unequip-btn").forEach(btn=>{
    btn.onclick = ()=>unequipSlot(btn.dataset.unequip);
  });
  
  // 商店分頁
  shopTabs.forEach(t=>{
    t.onclick=()=>{
      shopTabs.forEach(x=>x.classList.remove("active"));
      t.classList.add("active");
      const tab=t.getAttribute("data-tab");
      $("#buyPanel").style.display=(tab==="buy")?"block":"none";
      $("#sellPanel").style.display=(tab==="sell")?"block":"none";
    };
  });
  // 商店分類按鈕（全部／武器／防具/飾品／消耗品／坐騎／強化道具）
  if(shopCatBtns && shopCatBtns.length){
    shopCatBtns.forEach(b=>{
      b.onclick = ()=>{
        shopCatBtns.forEach(x=>x.classList.remove("active"));
        b.classList.add("active");
        shopCategory = b.getAttribute("data-cat") || "all";
        renderShop();
      };
    });
  }

  // 一鍵賣出按鈕
  if(bulkSellBtn && bulkSellFilter){
    bulkSellBtn.onclick = ()=>{
      const mode = bulkSellFilter.value;
      if(mode === "none"){
        alert("請先選擇一鍵賣出的條件。");
        return;
      }
      bulkSellByFilter(mode);
    };
  }

  // 偽裝＆鍵盤
  const introDlg = document.getElementById("introDlg");
  const introBtn = document.getElementById("introBtn");
  const introStartBtn = document.getElementById("introStartBtn");
  const introDontShow = document.getElementById("introDontShow");
  const INTRO_KEY = "stealth_rpg_intro_seen_v1";

  function anyDialogOpen(){
    return [invDlg,questDlg,classDlg,classNoticeDlg,shopDlg,mapDlg,skillDlg,helpDlg,enhDlg,introDlg].some(d=>d && d.open);
  }
  document.addEventListener("keydown",(e)=>{
    if(e.key==="Escape"){
      if(anyDialogOpen()){ [enhDlg,helpDlg,skillDlg,mapDlg,shopDlg,classDlg,classNoticeDlg,questDlg,invDlg,introDlg].forEach(d=>d && d.open&&d.close()); return; }
    }
    if(document.body.classList.contains("stealth")){ if(e.key==="Escape"){ document.body.classList.toggle("stealth"); } return; }
    const map={
      "1":"#exploreBtn","2":"#restBtn","3":"#battleBtn","4":"#attackBtn","5":"#skillBtn","6":"#invBtn","x":"#runBtn",
      "a":"#exploreBtn","r":"#restBtn","b":"#battleBtn","v":"#attackBtn","s":"#skillBtn","i":"#invBtn",
      "q":"#questBtn","c":"#classBtn","o":"#shopBtn","m":"#mapBtn","k":"#skillBookBtn","h":"#helpBtn"
    };
    if(e.key==="Escape"){ document.body.classList.toggle("stealth"); return; }
    const sel=map[e.key.toLowerCase()]; if(sel && !anyDialogOpen()){ const b=$(sel); if(b && !b.disabled) b.click(); }
  });
  $("#stealthBtn").onclick=()=>{
    if(anyDialogOpen()){ [enhDlg,helpDlg,skillDlg,mapDlg,shopDlg,classDlg,questDlg,invDlg,introDlg].forEach(d=>d && d.open&&d.close()); return; }
    document.body.classList.toggle("stealth");
  };

  function openIntro(force=false){
    try{
      const seen = localStorage.getItem(INTRO_KEY)==="1";
      if(seen && !force) return;
    }catch(e){}
    if(introDlg){
      introDlg.showModal();
      scheduleIntroAutoClose();
    }
  }
  function closeIntroAndMaybeRemember(){
    if(introAutoClose){
      clearTimeout(introAutoClose);
      introAutoClose = null;
    }
    if(introDontShow && introDontShow.checked){
      try{ localStorage.setItem(INTRO_KEY,"1"); }catch(e){}
    }
    if(introDlg) introDlg.close();
  }
  if(introBtn) introBtn.onclick = ()=> openIntro(true);
  if(introStartBtn) introStartBtn.onclick = closeIntroAndMaybeRemember;

  // 若玩家沒有點擊「開始遊戲」，自動關閉開場介紹避免卡住互動
  let introAutoClose = null;
  function scheduleIntroAutoClose(){
    if(introAutoClose) clearTimeout(introAutoClose);
    if(introStartBtn) introStartBtn.focus({preventScroll:true});
    introAutoClose = setTimeout(()=>{
      if(introDlg && introDlg.open){
        closeIntroAndMaybeRemember();
        say("🎬 已關閉開場介紹，開始冒險吧！");
      }
    }, 12000);
  }

  /* ========= 技能庫 Render ========= */
  function skillTypeLabel(sk){
    const map={
      active:"主動",
      debuff:"弱化",
      survival:"生存",
      passive:"被動",
      buff:"增益",
      control:"控場",
      defense:"防禦"
    };
    if(sk.type==="主動" || sk.type==="被動" || sk.type==="特殊") return sk.type;
    return map[sk.type] || sk.type || "技能";
  }
  const SKILL_POINT_RANGES={
    0:{start:1,end:9},
    1:{start:10,end:29},
    2:{start:30,end:69},
    3:{start:70,end:119},
    4:{start:120,end:200}
  };
  function tierLabel(tier){ return tier<=0?"0轉":`${tier}轉`; }
  function skillPointTierForLevel(lvl){
    for(const [t,r] of Object.entries(SKILL_POINT_RANGES)){
      const start = r.start ?? 1, end = r.end ?? start;
      if(lvl >= start && lvl <= end) return Number(t);
    }
    return null;
  }
  function skillPointRangeInfo(tier){
    const r = SKILL_POINT_RANGES[tier];
    if(!r) return null;
    const total = Math.max(0, (r.end || 0) - (r.start || 0) + 1);
    return { ...r, total, label:tierLabel(tier) };
  }
  const BASE_POINT_SKILL_LEVELS = { basicSlash:1 };
  function baseSkillLevel(id){ return BASE_POINT_SKILL_LEVELS[id] || 0; }
  function earnedSkillPointsForTier(tier, lvl){
    const r = SKILL_POINT_RANGES[tier];
    if(!r) return 0;
    const start = r.start ?? 1, end = r.end ?? start;
    if(lvl < start) return 0;
    const cap = Math.min(lvl, end);
    return Math.max(0, cap - start + 1);
  }
  function computeSkillPointsByTier(){
    const lvl = game.player?.lvl || 1;
    const earned={};
    Object.keys(SKILL_POINT_RANGES).forEach(k=>{
      const tier=Number(k);
      earned[tier] = earnedSkillPointsForTier(tier, lvl);
    });
    const spent={};
    Object.keys(SKILL_POINT_RANGES).forEach(k=> spent[Number(k)] = 0);
    Object.entries(SKILL).forEach(([id, sk])=>{
      if(sk.acquisition !== "point") return;
      const tier = skillTier(id);
      if(!(tier in SKILL_POINT_RANGES)) return;
      const lv = skillLevel(id,0);
      const cost = Math.max(0, lv - baseSkillLevel(id));
      spent[tier] = (spent[tier]||0) + cost;
    });
    const available={};
    Object.keys(SKILL_POINT_RANGES).forEach(k=>{
      const tier=Number(k);
      available[tier] = Math.max(0, (earned[tier]||0) - (spent[tier]||0));
    });
    return available;
  }
  function totalFreeSkillPoints(){
    const pools = game.player?.skillPointsByTier || {};
    return Object.values(pools).reduce((s,v)=>s+(v||0),0);
  }
  function refreshSkillPointBuckets(){
    game.player.skillPointsByTier = computeSkillPointsByTier();
    game.player.freeSkillPoints = totalFreeSkillPoints();
  }
  function freeSkillPointsForTier(tier){
    return Math.max(0, game.player?.skillPointsByTier?.[tier] || 0);
  }
  function renderSkillList(){
    refreshSkillPointBuckets();
    const box=$("#skillList"); box.innerHTML="";
    const playerRootJob = rootJobOf(game.player?.job);
    const playerJob = game.player?.job;
    const entries = Object.keys(SKILL).filter(id=>{
      const sk = SKILL[id];
      if(!sk) return false;
      if(skillTier(id) !== currentSkillTierTab) return false;
      if(sk.tree){
        const allowedTree = sk.tree === playerRootJob || isJobInLineage(playerJob, sk.tree);
        if(!allowedTree) return false;
      }
      return true;
    });
    const points = freeSkillPointsForTier(currentSkillTierTab);
    const rangeInfo = skillPointRangeInfo(currentSkillTierTab);
    const rangeText = rangeInfo ? `（${rangeInfo.label}技能點來源：Lv.${rangeInfo.start}-${rangeInfo.end}｜共 ${rangeInfo.total} 點）` : "";
    const tip=document.createElement("div");
    tip.className="row";
    tip.innerHTML = `<span class="muted">${tierLabel(currentSkillTierTab)}剩餘技能點數：<b>${points}</b>${rangeText}</span>`;
    box.appendChild(tip);

    const hint=$("#skillHint");
    if(hint){
      const base="主動技可設為「當前技能」。";
      if(rangeInfo){
        const capNote = currentSkillTierTab===0 ? "，初心者單技上限 Lv.3" : "";
        hint.textContent = `${base}${rangeInfo.label}技能消耗技能點（Lv.${rangeInfo.start}-${rangeInfo.end} 共 ${rangeInfo.total} 點${capNote}）。`;
      }else{
        hint.textContent = `${base}技能升級方式依各技能規則而定。`;
      }
    }

    document.querySelectorAll('#skillTabs button').forEach(btn=>{
      const t = Number(btn.dataset.tier||0);
      btn.classList.toggle('active', t === currentSkillTierTab);
    });

    const allowedTiers = allowedSkillTiersForPlayer();

    entries.forEach(id=>{
      const sk=SKILL[id]; if(!sk) return;
      const lv=skillLevel(id,0); const qual=(game.player.skillQual||{})[id]||0; const max=skillMaxLv(id);
      const row=document.createElement("div"); row.className="row";
      const typeLabel = skillTypeLabel(sk);
      const tierAllowed = allowedTiers.includes(skillTier(id));
      const treeAllowed = !sk.tree || !sk.tier || sk.tier <= 0 ||
        playerRootJob === sk.tree || isJobInLineage(playerJob, sk.tree);
      const statusNotes = [];
      if(!tierAllowed) statusNotes.push("未解鎖該轉職階段");
      if(!treeAllowed) statusNotes.push(`僅限 ${jobName(sk.tree)} 系`);
      if(lv<=0) statusNotes.push("尚未習得");

      const tagParts = [`【${typeLabel}】Lv.${lv}/${max}${qual>=1?`｜${QUALS[qual]}`:""}`];
      if(sk.tree) tagParts.push(`｜${jobName(sk.tree)}系`);

      const extra = statusNotes.length>0 ? `<div class="muted">🔒 ${statusNotes.join("｜")}</div>` : "";
      row.innerHTML=`<div><b>${sk.name}</b> <span class="tag">${tagParts.join("")}</span><br><span class="muted">${sk.desc}</span>${extra}</div>`;
      const right=document.createElement("div"); right.className="right";
      if(typeof sk.use === "function"){
        const setBtn=btn( game.player.activeSkill===id?"當前技能✓":"設為當前", ()=>{ game.player.activeSkill=id; say(`📚 已將當前技能設為 <b>${sk.name}</b>。`); $("#activeSkillName").textContent=skillNameWithLv(id); autosave(); renderSkillList(); });
        if(lv<=0) setBtn.disabled=true;
        right.append(setBtn);
      }else{
        const pass=btn(sk.type==="特殊"?"特殊效果":"被動生效", ()=>{}); pass.disabled=true; right.append(pass);
      }

      if(sk.acquisition==="point"){
        const canUp = lv < max && points > 0 && tierAllowed && treeAllowed;
        const upLab = lv>0 ? "升級 +1（消耗 1 點）" : "習得 Lv.1（消耗 1 點）";
        const upBtn = btn(upLab, ()=> upgradeSkillByPoint(id));
        upBtn.disabled = !canUp;
        right.append(upBtn);
      }

      row.append(right); box.appendChild(row);
    });
  }

  /* ========= 初始化 ========= */
  function renderFake(){
    const rows=[]; const depts=["Sales","Marketing","Ops","Finance","HR","R&D","CS"];
    for(let i=0;i<12;i++){ const d=depts[i%depts.length]; const kpi=["CTR","MRR","AHT","NPS","Churn","ARPU","Util"][i%7];
      const target=rnd(80,120), actual=target+rnd(-12,12), delta=actual-target;
      rows.push(`<tr><td style="text-align:left">${d}-${String(i+1).padStart(2,"0")}</td><td style="text-align:left">${kpi}</td><td>${target}</td><td>${actual}</td><td style="color:${delta>=0?'#16a34a':'#dc2626'}">${delta>=0?'+':''}${delta}</td></tr>`); }
    $("#fakeRows").innerHTML=rows.join("");
  }

  function intro(){ say("你踏上旅途——每 10 等一張地圖直到 200，轉職四階，Boss 獨立地圖掉坐騎/神器。"); say("提示：按 Esc 可切換偽裝；打開『❓ 說明』查看完整規則。"); }

  const _origEnd=endBattle;
  endBattle=function(v){ if(v && game.state.enemy){ updateQuestProgressOnKill(game.state.enemy.name); } _origEnd(v); };

  function explore(){
    if(game.state.inBattle) return say("戰鬥中無法探索！");
    const z=currentZone(), roll=rnd(1,100);
    if(roll<=62 || z.boss){
      startBattle();
    }else if(roll<=85){
      const g=Math.round(rnd(3,10)*GOLD_RATE* (1 + (game.player.equip.mount?0.1:0)));
      game.player.gold+=g; say(`你在 ${z.name} 拾獲 <b>${g}G</b>。`);
    }else{
      const options = ["小治療藥水","小魔力藥水"];
      const find=options[rnd(0,options.length-1)]; addInv(find,1); say(`你在 ${z.name} 發現 <b>${find}</b> ×1。`);
    }
    render();
  }
  function rest(){ if(game.state.inBattle) return say("戰鬥中不能休息！"); 
  // 20%～80% 隨機回復（依上限）
const pct = 0.2 + Math.random() * 0.6;               // 0.2~0.8
const h = Math.max(1, Math.floor(game.player.maxhp * pct));
const regen = Math.floor(game.player.manaRegen || 0);
const m = Math.max(1, Math.floor(game.player.maxmp * pct) + regen);

  game.player.hp=clamp(game.player.hp+h,0,game.player.maxhp); game.player.mp=clamp(game.player.mp+m,0,game.player.maxmp); say(`你在 ${currentZone().name} 小憩，回復 <b>${h} HP</b> 與 <b>${m} MP</b>。`); if(Math.random()<0.2) advanceDay(1); render(); }
  function tryRun(){ 
  if(!game.state.inBattle) return say("現在沒有在戰鬥。"); 
  const ok = Math.random() < 0.6; 
  if(ok){ 
    // ✅ 改成單純脫離戰鬥，不結算勝利
    game.state.inBattle = false;
    game.state.enemy = null;
    $("#runBtn").disabled = true;
    say("🏃‍♂️ 你成功脫離了戰鬥。");
    render(); autosave();
  } else { 
    say("你試圖逃跑，但失敗了！"); 
    enemyTurn(); 
  } 
  }
    // 啟動
  load();
  ensureStarterEquipment();
  initAllArtifactFragments();            // ⬅ 在這裡先註冊所有神器碎片道具
  renderFake();
  ensureStock();
  recomputeStats(true);
  if(game.quests.length===0) seedQuests();
  intro();
  render();
  // 開場介紹只在未勾選不再顯示時跳出
  try{ if(localStorage.getItem(INTRO_KEY)!=="1"){ openIntro(false); } }catch(e){ openIntro(false); }

  // 生成按鈕（小工具）
  function btn(txt,fn){ const b=document.createElement("button"); b.className="btn small"; b.textContent=txt; b.onclick=fn; return b; }

})();
