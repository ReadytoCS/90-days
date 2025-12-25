import React, { useState, useEffect } from 'react';
import { storage, storageService } from './lib/storage';
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  getSubscriptionStatus,
  updateNotificationPreferences,
  getNotificationPreferences,
  sendTestPush
} from './lib/pushNotifications';

// Utilities with timezone fix
const utils = {
  id: () => Math.random().toString(36).substr(2, 9),
  today: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
  formatDate: (s) => new Date(s+'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  greeting: () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; },
  progress: (objs) => { if (!objs?.length) return 0; const w = { easy: 1, medium: 2, hard: 4 }; const t = objs.reduce((a,o) => a + w[o.difficulty], 0); return Math.round(objs.filter(o => o.completed).reduce((a,o) => a + w[o.difficulty], 0) / t * 100); },
  quarter: () => { const n = new Date(), q = Math.floor(n.getMonth()/3)+1, y = n.getFullYear(), s = new Date(y,(q-1)*3,1), e = new Date(y,q*3,0), left = Math.max(0, Math.ceil((e-n)/864e5)), total = Math.ceil((e-s)/864e5); return { key: `Q${q}-${y}`, label: `Q${q} ${y}`, left, total, week: Math.ceil((total-left)/7)||1 }; },
  weekDates: (off=0) => { const t = new Date(), d = t.getDay(), s = new Date(t); s.setDate(t.getDate()-(d===0?6:d-1)+off*7); return Array.from({length:7},(_,i) => { const x = new Date(s); x.setDate(s.getDate()+i); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }); },
  weekLabel: (off) => off===0 ? 'This Week' : off===-1 ? 'Last Week' : `${new Date(utils.weekDates(off)[0]+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${new Date(utils.weekDates(off)[6]+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}`,
  haptic: () => navigator.vibrate?.(10)
};

const colors = { easy: '#22c55e', medium: '#eab308', hard: '#ef4444' };

export default function ReflectApp() {
  const [view, setView] = useState('home');
  const [goals, setGoals] = useState([]);
  const [logs, setLogs] = useState([]);
  const [qtr] = useState(utils.quarter());
  const [selGoal, setSelGoal] = useState(null);
  const [selObj, setSelObj] = useState(null);
  const [intention, setIntention] = useState('');
  const [status, setStatus] = useState(null);
  const [reflection, setReflection] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [addObj, setAddObj] = useState(null);
  const [newObj, setNewObj] = useState('');
  const [newDiff, setNewDiff] = useState('medium');
  const [onboard, setOnboard] = useState(false);
  const [obGoals, setObGoals] = useState(['', '', '']);
  const [closed, setClosed] = useState(false);
  const [weekOff, setWeekOff] = useState(0);
  const [showRecap, setShowRecap] = useState(false);
  const [toast, setToast] = useState(null);
  const [undoData, setUndoData] = useState(null);
  const [lastLog, setLastLog] = useState(null);
  const [notifMorning, setNotifMorning] = useState(false);
  const [notifEvening, setNotifEvening] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);

  const today = utils.today();
  const todayLog = logs.find(l => l.date === today);
  const prompts = ["What made today easier or harder?", "What did you learn today?", "What's one small win?", "What would you do differently?"];
  const [prompt] = useState(prompts[Math.floor(Math.random() * prompts.length)]);

  // Load & auto-close missed days
  useEffect(() => {
    const loadData = async () => {
      // Pull latest from Supabase if online
      await storageService.pull();
      
      // Get data (works offline from localStorage)
      const allGoals = await storage.get('r_goals', []);
      const g = allGoals.filter(x => x.qtr === qtr.key);
      let l = await storage.get('r_logs', []);
      
      // Auto-close missed days
      l = l.map(log => (log.date < today && !log.closed && log.intention) 
        ? { ...log, status: 'missed', closed: new Date().toISOString() } : log);
      
      const completed = l.filter(x => x.closed && x.goalId).sort((a,b) => b.date.localeCompare(a.date));
      if (completed[0]) setLastLog(completed[0]);
      
      setGoals(g); setLogs(l);
      if (!g.length) setOnboard(true);
      
      const t = l.find(x => x.date === today);
      if (t) { setIntention(t.intention||''); setSelGoal(t.goalId); setSelObj(t.objId); }
      
      await storage.set('r_logs', l);
    };
    
    loadData();
  }, []);

  // Save
  useEffect(() => {
    const saveGoals = async () => {
      await storageService.saveGoals(goals, qtr.key);
    };
    if (goals.length >= 0) {
      saveGoals();
    }
  }, [goals, qtr.key]);
  
  useEffect(() => {
    const saveLogs = async () => {
      await storage.set('r_logs', logs);
    };
    saveLogs();
  }, [logs]);

  // Computed (using state instead of storage for real-time updates)
  const [allGoalsState, setAllGoalsState] = useState([]);
  
  useEffect(() => {
    const loadAllGoals = async () => {
      const all = await storage.get('r_goals', []);
      setAllGoalsState(all);
    };
    loadAllGoals();
  }, [goals]);

  // Load push notification status
  useEffect(() => {
    const loadPushStatus = async () => {
      const supported = isPushSupported();
      setPushSupported(supported);
      
      if (supported) {
        const status = await getSubscriptionStatus();
        setPushSubscribed(status.subscribed);
        
        const prefs = await getNotificationPreferences();
        setNotifMorning(prefs.morning);
        setNotifEvening(prefs.evening);
      }
    };
    loadPushStatus();
  }, []);

  // Handle navigation from notification clicks
  useEffect(() => {
    const handleNavigate = (event) => {
      if (event.detail && event.detail.view) {
        setView(event.detail.view);
        // Update URL without reload
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('view', event.detail.view);
        window.history.pushState({}, '', newUrl);
      }
    };
    
    // Check URL params on load
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    if (viewParam && ['morning', 'evening', 'settings'].includes(viewParam)) {
      setView(viewParam);
    }
    
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);
  
  const pastQuarters = [...new Set(allGoalsState.map(g => g.qtr))].filter(q => q !== qtr.key).sort().reverse();
  const weekDates = utils.weekDates(weekOff);
  const weekLogs = logs.filter(l => weekDates.includes(l.date));
  const weekActivity = weekDates.map(d => weekLogs.find(l => l.date === d)?.closed ? weekLogs.find(l => l.date === d).status : null);
  const overall = goals.length ? Math.round(goals.reduce((a,g) => a + utils.progress(g.objs), 0) / goals.length) : 0;
  const qLogs = logs.filter(l => l.closed && l.status !== 'skipped');
  const stats = { days: qLogs.length, yes: qLogs.filter(l => l.status==='yes').length, partial: qLogs.filter(l => l.status==='partial').length, no: qLogs.filter(l => l.status==='no'||l.status==='missed').length, done: goals.reduce((a,g) => a + g.objs.filter(o => o.completed).length, 0) };

  // Toast
  const showToast = (msg, undo = null) => { setToast(msg); setUndoData(undo); setTimeout(() => { setToast(null); setUndoData(null); }, 3500); };
  const handleUndo = () => { if (undoData) { setGoals(undoData); setToast(null); setUndoData(null); utils.haptic(); } };

  // Actions
  const createGoals = () => { const v = obGoals.filter(g => g.trim()); if (!v.length) return; utils.haptic(); setGoals([...goals, ...v.map(n => ({ id: utils.id(), name: n, objs: [], qtr: qtr.key }))]); setObGoals(['','','']); setOnboard(false); };
  
  const addObjective = (gid) => { if (!newObj.trim()) return; if (goals.find(g => g.id===gid).objs.length >= 7) { showToast('Max 7 objectives per goal'); return; } utils.haptic(); setGoals(goals.map(g => g.id===gid ? { ...g, objs: [...g.objs, { id: utils.id(), text: newObj, difficulty: newDiff, completed: false }] } : g)); setNewObj(''); setNewDiff('medium'); setAddObj(null); };
  
  const toggleObj = (gid, oid) => { utils.haptic(); setGoals(goals.map(g => g.id===gid ? { ...g, objs: g.objs.map(o => o.id===oid ? { ...o, completed: !o.completed } : o) } : g)); };
  
  const delObj = (gid, oid) => { const prev = JSON.parse(JSON.stringify(goals)); utils.haptic(); setGoals(goals.map(g => g.id===gid ? { ...g, objs: g.objs.filter(o => o.id !== oid) } : g)); showToast('Deleted', prev); };
  
  const saveIntent = () => { if (!intention.trim() || !selGoal || !selObj) return; utils.haptic(); const ex = logs.find(l => l.date===today); if (ex) setLogs(logs.map(l => l.date===today ? { ...l, intention, goalId: selGoal, objId: selObj } : l)); else setLogs([...logs, { id: utils.id(), date: today, intention, goalId: selGoal, objId: selObj }]); setView('home'); };
  
  const sameAsYesterday = () => { if (!lastLog) return; const g = goals.find(x => x.id===lastLog.goalId); const o = g?.objs.find(x => x.id===lastLog.objId && !x.completed); if (!g||!o) { showToast('Previous objective done!'); return; } utils.haptic(); setSelGoal(lastLog.goalId); setSelObj(lastLog.objId); setIntention(lastLog.intention); };
  
  const skipDay = () => { utils.haptic(); const ex = logs.find(l => l.date===today); if (ex) setLogs(logs.map(l => l.date===today ? { ...l, status: 'skipped', closed: new Date().toISOString() } : l)); else setLogs([...logs, { id: utils.id(), date: today, status: 'skipped', closed: new Date().toISOString() }]); showToast('Day skipped 🌙'); };
  
  const closeDay = () => { if (!status) return; utils.haptic(); setClosed(true); if (status==='yes' && selGoal && selObj) setGoals(goals.map(g => g.id===selGoal ? { ...g, objs: g.objs.map(o => o.id===selObj ? { ...o, completed: true } : o) } : g)); setLogs(logs.map(l => l.date===today ? { ...l, status, reflection, closed: new Date().toISOString() } : l)); setTimeout(() => { setClosed(false); setStatus(null); setReflection(''); setView('home'); }, 1800); };
  
  const startFresh = () => { utils.haptic(); setGoals([]); setShowRecap(false); setOnboard(true); setSelGoal(null); setSelObj(null); setIntention(''); };

  // Components
  const Bar = ({ p, c, h=8 }) => <div style={{ width: '100%', height: h, background: 'rgba(255,255,255,0.1)', borderRadius: h/2 }}><div style={{ width: `${Math.min(100,p)}%`, height: '100%', background: c, borderRadius: h/2, transition: 'width 0.5s' }} /></div>;
  
  const StatusDot = ({ s, size=10 }) => <div style={{ width: size, height: size, borderRadius: '50%', background: s ? ({ yes:'#22c55e', partial:'#eab308', no:'#ef4444', missed:'#ef4444', skipped:'#6b7280' }[s]) : 'rgba(255,255,255,0.15)', opacity: s==='skipped' ? 0.5 : 1 }} />;
  
  const WeekDots = ({ act }) => <div style={{ display: 'flex', gap: 8 }}>{['M','T','W','T','F','S','S'].map((d,i) => <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><StatusDot s={act[i]} /><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{d}</span></div>)}</div>;
  
  const Badge = ({ d }) => <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', background: `${colors[d]}20`, color: colors[d] }}>{d}</span>;
  
  const Back = ({ fn }) => <button onClick={() => { utils.haptic(); fn(); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', marginBottom: 24, padding: '8px 0' }}>‹ Back</button>;
  
  const Toast = () => toast && <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)', left: 20, right: 20, background: 'rgba(255,255,255,0.95)', color: '#000', padding: '14px 20px', borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 200 }}><span style={{ fontSize: 14, fontWeight: 500 }}>{toast}</span>{undoData && <button onClick={handleUndo} style={{ background: 'rgba(0,0,0,0.1)', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Undo</button>}</div>;

  const GoalCard = ({ g }) => {
    const p = utils.progress(g.objs), exp = expanded === g.id, dn = g.objs.filter(o => o.completed).length;
    return (
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden' }}>
        <div onClick={() => { utils.haptic(); setExpanded(exp ? null : g.id); }} style={{ padding: 20, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div><h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 600, color: '#fff' }}>{g.name}</h3><span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{g.objs.length ? `${dn}/${g.objs.length} objectives` : 'Add objectives to start'}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 24, fontWeight: 600, color: p >= 50 ? '#22c55e' : p > 0 ? '#eab308' : 'rgba(255,255,255,0.3)' }}>{p}%</span><span style={{ color: 'rgba(255,255,255,0.3)', transform: exp ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', fontSize: 12 }}>▼</span></div>
          </div>
          <Bar p={p} c={p >= 50 ? '#22c55e' : p > 0 ? '#eab308' : 'rgba(255,255,255,0.2)'} />
        </div>
        {exp && (
          <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {g.objs.length === 0 && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', padding: 8 }}>What steps will get you there?</p>}
              {g.objs.map(o => (
                <div key={o.id} onClick={() => toggleObj(g.id, o.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, cursor: 'pointer' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, border: o.completed ? 'none' : '2px solid rgba(255,255,255,0.2)', background: o.completed ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{o.completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20,6 9,17 4,12" /></svg>}</div>
                  <span style={{ flex: 1, color: o.completed ? 'rgba(255,255,255,0.4)' : '#fff', textDecoration: o.completed ? 'line-through' : 'none', fontSize: 15 }}>{o.text}</span>
                  <Badge d={o.difficulty} />
                  <button onClick={(e) => { e.stopPropagation(); delObj(g.id, o.id); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, padding: 4 }}>×</button>
                </div>
              ))}
              {addObj === g.id ? (
                <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                  <input value={newObj} onChange={(e) => setNewObj(e.target.value)} placeholder="Be specific: 'Run 2 miles' not 'Exercise'" autoFocus style={{ width: '100%', padding: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '0 0 12px' }}>Easy = quick win • Medium = few days • Hard = major milestone</p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>{['easy','medium','hard'].map(d => <button key={d} onClick={() => setNewDiff(d)} style={{ flex: 1, padding: 10, background: newDiff===d ? `${colors[d]}20` : 'rgba(255,255,255,0.05)', border: newDiff===d ? `2px solid ${colors[d]}` : '2px solid transparent', borderRadius: 10, color: newDiff===d ? colors[d] : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>{d}</button>)}</div>
                  <div style={{ display: 'flex', gap: 8 }}><button onClick={() => { setAddObj(null); setNewObj(''); }} style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 10, color: 'rgba(255,255,255,0.5)', fontSize: 15, cursor: 'pointer' }}>Cancel</button><button onClick={() => addObjective(g.id)} style={{ flex: 1, padding: 12, background: '#3b82f6', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Add</button></div>
                </div>
              ) : g.objs.length < 7 && <button onClick={() => setAddObj(g.id)} style={{ padding: 14, background: 'none', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 12, color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer' }}>+ Add Objective</button>}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Views
  const Home = () => (
    <div style={{ padding: '24px 24px calc(env(safe-area-inset-bottom, 20px) + 24px)', maxWidth: 500, margin: '0 auto' }}>
      <div style={{ marginBottom: 28, paddingTop: 'env(safe-area-inset-top, 0)' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{qtr.label} · {qtr.left} days left</p>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 300, color: '#fff' }}>{utils.greeting()}</h1>
      </div>

      <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', borderRadius: 20, padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ width: 100, height: 100, borderRadius: '50%', background: `conic-gradient(#22c55e ${overall*3.6}deg, rgba(255,255,255,0.08) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 78, height: 78, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 28, fontWeight: 300, color: '#fff' }}>{overall}%</span></div>
        </div>
        <div><p style={{ margin: '0 0 6px', color: '#fff', fontSize: 17, fontWeight: 500 }}>Overall Progress</p><p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Week {qtr.week} of 13</p></div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <button onClick={() => { utils.haptic(); setWeekOff(weekOff-1); }} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer', padding: '8px 14px', borderRadius: 8 }}>‹</button>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>{utils.weekLabel(weekOff)}</span>
          <button onClick={() => { utils.haptic(); setWeekOff(Math.min(0, weekOff+1)); }} disabled={weekOff>=0} style={{ background: weekOff>=0 ? 'transparent' : 'rgba(255,255,255,0.05)', border: 'none', color: weekOff>=0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)', fontSize: 18, cursor: weekOff>=0 ? 'default' : 'pointer', padding: '8px 14px', borderRadius: 8 }}>›</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <WeekDots act={weekActivity} />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{weekActivity.filter(s => s==='yes').length} ✓{weekActivity.filter(s => s==='partial').length > 0 && ` · ${weekActivity.filter(s => s==='partial').length} ◐`}</span>
        </div>
        {weekOff !== 0 && <button onClick={() => { utils.haptic(); setWeekOff(0); }} style={{ width: '100%', marginTop: 14, padding: 10, background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 10, color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>Back to This Week</button>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {goals.map(g => <GoalCard key={g.id} g={g} />)}
        {!goals.length && !onboard && (
          <div style={{ textAlign: 'center', padding: 32, background: 'rgba(255,255,255,0.02)', borderRadius: 16 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 16px', fontSize: 15 }}>Your journey starts with a goal</p>
            <button onClick={() => setOnboard(true)} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>Set Your Goals</button>
          </div>
        )}
      </div>

      {goals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!todayLog?.closed && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { utils.haptic(); setView('morning'); }} style={{ flex: 1, padding: '18px 20px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 14, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>{todayLog?.intention ? 'Update Intention' : 'Set Intention'}</button>
              {todayLog?.intention && <button onClick={() => { utils.haptic(); setView('evening'); }} style={{ flex: 1, padding: '18px 20px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', border: 'none', borderRadius: 14, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Close Day</button>}
            </div>
          )}
          {!todayLog?.closed && !todayLog?.intention && <button onClick={skipDay} style={{ padding: 14, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer' }}>Skip Today (rest day, traveling)</button>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { utils.haptic(); setView('history'); }} style={{ flex: 1, padding: '16px 20px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>History</button>
            <button onClick={() => { utils.haptic(); setView('settings'); }} style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>⚙️</button>
          </div>
        </div>
      )}

      {todayLog?.closed && <div style={{ marginTop: 8, padding: 20, background: todayLog?.status==='skipped' ? 'rgba(107,114,128,0.1)' : 'rgba(34,197,94,0.1)', borderRadius: 14, textAlign: 'center' }}><p style={{ color: todayLog?.status==='skipped' ? '#9ca3af' : '#22c55e', margin: 0, fontSize: 15, fontWeight: 500 }}>{todayLog?.status==='skipped' ? '🌙 Rest day. See you tomorrow!' : '✓ Day closed. Well done!'}</p></div>}
      
      {goals.length > 0 && goals.length < 3 && <button onClick={() => setOnboard(true)} style={{ width: '100%', marginTop: 20, padding: 14, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 14, cursor: 'pointer' }}>+ Add Another Goal</button>}
    </div>
  );

  const Morning = () => {
    const goal = goals.find(g => g.id === selGoal);
    const inc = goal?.objs?.filter(o => !o.completed) || [];
    const canUseLast = lastLog && goals.find(g => g.id===lastLog.goalId)?.objs.find(o => o.id===lastLog.objId && !o.completed);

    return (
      <div style={{ padding: '24px 24px calc(env(safe-area-inset-bottom, 20px) + 24px)', maxWidth: 500, margin: '0 auto' }}>
        <div style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}><Back fn={() => setView('home')} /></div>
        <div style={{ marginBottom: 32 }}><p style={{ color: '#3b82f6', margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Morning Ritual</p><h1 style={{ margin: 0, fontSize: 28, fontWeight: 300, color: '#fff' }}>What's your focus today?</h1></div>

        {canUseLast && !selGoal && (
          <button onClick={sameAsYesterday} style={{ width: '100%', padding: 18, marginBottom: 24, background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}>
            <p style={{ color: '#22c55e', margin: '0 0 4px', fontSize: 13, fontWeight: 600 }}>⚡ Quick Start</p>
            <p style={{ color: '#fff', margin: '0 0 4px', fontSize: 15 }}>{lastLog.intention}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: 12 }}>Same as last time</p>
          </button>
        )}

        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 12, fontSize: 14, fontWeight: 600 }}>1. Choose your goal</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {goals.map(g => <div key={g.id} onClick={() => { utils.haptic(); setSelGoal(g.id); setSelObj(null); }} style={{ padding: 18, background: selGoal===g.id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)', borderRadius: 14, cursor: 'pointer', border: selGoal===g.id ? '2px solid rgba(59,130,246,0.4)' : '2px solid transparent' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#fff', fontSize: 16, fontWeight: 500 }}>{g.name}</span><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{g.objs?.filter(o => !o.completed).length || 0} left</span></div></div>)}
        </div>

        {selGoal && (<><p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 12, fontSize: 14, fontWeight: 600 }}>2. Pick an objective</p><div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>{inc.length ? inc.map(o => <div key={o.id} onClick={() => { utils.haptic(); setSelObj(o.id); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: selObj===o.id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)', borderRadius: 12, cursor: 'pointer', border: selObj===o.id ? '2px solid rgba(59,130,246,0.4)' : '2px solid transparent' }}><span style={{ flex: 1, color: '#fff', fontSize: 15 }}>{o.text}</span><Badge d={o.difficulty} /></div>) : <div style={{ padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 12, textAlign: 'center' }}><p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 12px', fontSize: 14 }}>All objectives complete! 🎉</p><button onClick={() => { setView('home'); setExpanded(selGoal); }} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, cursor: 'pointer' }}>Add new objectives</button></div>}</div></>)}

        {selObj && (<><p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 12, fontSize: 14, fontWeight: 600 }}>3. What specifically will you do?</p><input value={intention} onChange={(e) => setIntention(e.target.value)} placeholder="e.g., Write for 30 minutes after coffee" autoFocus style={{ width: '100%', padding: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, color: '#fff', fontSize: 16, outline: 'none', marginBottom: 28, boxSizing: 'border-box' }} /></>)}

        <button onClick={saveIntent} disabled={!intention.trim() || !selGoal || !selObj} style={{ width: '100%', padding: '18px 24px', background: (intention.trim() && selGoal && selObj) ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 14, color: (intention.trim() && selGoal && selObj) ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 17, fontWeight: 600, cursor: (intention.trim() && selGoal && selObj) ? 'pointer' : 'not-allowed' }}>Lock It In</button>
      </div>
    );
  };

  const Evening = () => {
    const goal = goals.find(g => g.id === selGoal);
    const obj = goal?.objs?.find(o => o.id === selObj);

    return (
      <div style={{ padding: '24px 24px calc(env(safe-area-inset-bottom, 20px) + 24px)', maxWidth: 500, margin: '0 auto' }}>
        <div style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}><Back fn={() => setView('home')} /></div>
        <div style={{ marginBottom: 32 }}><p style={{ color: '#8b5cf6', margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Evening Reflection</p><h1 style={{ margin: 0, fontSize: 28, fontWeight: 300, color: '#fff' }}>How did it go?</h1></div>

        {todayLog?.intention && goal && obj && <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 18, marginBottom: 28 }}><p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 6px', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>Today's focus</p><p style={{ color: '#fff', margin: '0 0 12px', fontSize: 16 }}>{todayLog.intention}</p><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{goal.name}</span><span style={{ color: 'rgba(255,255,255,0.2)' }}>→</span><span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{obj.text}</span></div></div>}

        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 14, fontSize: 14, fontWeight: 600 }}>Did you do it?</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[{ v: 'yes', l: 'Yes', s: 'Nailed it', c: '#22c55e', e: '✓' }, { v: 'partial', l: 'Partial', s: 'Some progress', c: '#eab308', e: '◐' }, { v: 'no', l: 'No', s: "Didn't happen", c: '#ef4444', e: '✗' }].map(o => (
            <button key={o.v} onClick={() => { utils.haptic(); setStatus(o.v); }} style={{ flex: 1, padding: '18px 12px', background: status===o.v ? `${o.c}15` : 'rgba(255,255,255,0.04)', border: status===o.v ? `2px solid ${o.c}` : '2px solid transparent', borderRadius: 14, color: status===o.v ? o.c : 'rgba(255,255,255,0.6)', cursor: 'pointer', textAlign: 'center' }}><div style={{ fontSize: 24, marginBottom: 4 }}>{o.e}</div><div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{o.l}</div><div style={{ fontSize: 11, opacity: 0.7 }}>{o.s}</div></button>
          ))}
        </div>

        {status === 'partial' && <div style={{ padding: 14, background: 'rgba(234,179,8,0.1)', borderRadius: 12, marginBottom: 20 }}><p style={{ color: '#eab308', margin: 0, fontSize: 14 }}>Progress counts. Partial is better than zero. 💪</p></div>}
        {status === 'no' && <div style={{ padding: 14, background: 'rgba(239,68,68,0.1)', borderRadius: 12, marginBottom: 20 }}><p style={{ color: '#f87171', margin: 0, fontSize: 14 }}>Tomorrow's a fresh start. What got in the way? 🌱</p></div>}

        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 12, fontSize: 14, fontWeight: 600 }}>{prompt}</p>
        <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="A few words... (optional)" rows={3} style={{ width: '100%', padding: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, color: '#fff', fontSize: 16, outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: 28, boxSizing: 'border-box' }} />

        <button onClick={closeDay} disabled={!status} style={{ width: '100%', padding: '18px 24px', background: status ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 14, color: status ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 17, fontWeight: 600, cursor: status ? 'pointer' : 'not-allowed' }}>Close Your Day</button>
      </div>
    );
  };

  const History = () => {
    const [hOff, setHOff] = useState(0);
    const [viewQ, setViewQ] = useState(null);
    const hDates = utils.weekDates(hOff);
    const hLogs = logs.filter(l => hDates.includes(l.date));
    const hAct = hDates.map(d => hLogs.find(x => x.date===d)?.closed ? hLogs.find(x => x.date===d).status : null);
    const rate = stats.days ? Math.round((stats.yes/stats.days)*100) : 0;
    const getPastQ = (qKey) => { const qG = allGoalsState.filter(g => g.qtr===qKey); return { goals: qG, done: qG.reduce((a,g) => a + (g.objs?.filter(o => o.completed).length||0), 0) }; };

    if (viewQ) {
      const pq = getPastQ(viewQ);
      return (
        <div style={{ padding: '24px 24px calc(env(safe-area-inset-bottom, 20px) + 24px)', maxWidth: 500, margin: '0 auto' }}>
          <div style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}><Back fn={() => setViewQ(null)} /></div>
          <div style={{ marginBottom: 32 }}><p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase' }}>Past Quarter</p><h1 style={{ margin: 0, fontSize: 26, fontWeight: 300, color: '#fff' }}>{viewQ.replace('-', ' ')}</h1></div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', color: '#fff', fontSize: 16, fontWeight: 600 }}>Goals</h3>
            {pq.goals.map((g, i) => { const p = utils.progress(g.objs||[]); return (
              <div key={g.id} style={{ padding: '14px 0', borderBottom: i < pq.goals.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: '#fff', fontSize: 15 }}>{g.name}</span><span style={{ color: p >= 70 ? '#22c55e' : p >= 40 ? '#eab308' : 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: 600 }}>{p}%</span></div>
                <Bar p={p} c={p >= 70 ? '#22c55e' : p >= 40 ? '#eab308' : 'rgba(255,255,255,0.3)'} />
              </div>
            ); })}
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: '24px 24px calc(env(safe-area-inset-bottom, 20px) + 24px)', maxWidth: 500, margin: '0 auto' }}>
        <div style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}><Back fn={() => setView('home')} /></div>
        <div style={{ marginBottom: 32 }}><p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase' }}>{qtr.label}</p><h1 style={{ margin: 0, fontSize: 26, fontWeight: 300, color: '#fff' }}>History</h1></div>

        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <button onClick={() => { utils.haptic(); setHOff(hOff-1); }} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer', padding: '8px 14px', borderRadius: 8 }}>‹</button>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>{utils.weekLabel(hOff)}</span>
            <button onClick={() => { utils.haptic(); setHOff(Math.min(0, hOff+1)); }} disabled={hOff>=0} style={{ background: hOff>=0 ? 'transparent' : 'rgba(255,255,255,0.05)', border: 'none', color: hOff>=0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)', fontSize: 18, cursor: hOff>=0 ? 'default' : 'pointer', padding: '8px 14px', borderRadius: 8 }}>›</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hLogs.filter(l => l.closed).length > 0 ? 16 : 0 }}><WeekDots act={hAct} /><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{hAct.filter(s => s==='yes').length} ✓</span></div>
          {hLogs.filter(l => l.closed).length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{hDates.map(d => { const l = hLogs.find(x => x.date===d && x.closed); if (!l) return null; const g = goals.find(x => x.id===l.goalId); const sc = { yes:'#22c55e', partial:'#eab308', no:'#ef4444', missed:'#ef4444', skipped:'#6b7280' }; return <div key={d} style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: l.intention ? 6 : 0 }}><span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{utils.formatDate(d)}</span><span style={{ padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', background: `${sc[l.status]}20`, color: sc[l.status] }}>{l.status==='missed' ? 'missed' : l.status}</span></div>{l.intention && <p style={{ color: '#fff', margin: '0 0 4px', fontSize: 14 }}>{l.intention}</p>}{g && <p style={{ color: 'rgba(255,255,255,0.3)', margin: 0, fontSize: 12 }}>{g.name}</p>}{l.reflection && <p style={{ color: 'rgba(255,255,255,0.4)', margin: '8px 0 0', fontSize: 13, fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>"{l.reflection}"</p>}</div>; })}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>{[{ l: 'Days', v: stats.days }, { l: 'Completed', v: stats.yes }, { l: 'Success', v: `${rate}%` }].map(s => <div key={s.l} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 16, textAlign: 'center' }}><p style={{ color: '#fff', margin: '0 0 4px', fontSize: 26, fontWeight: 300 }}>{s.v}</p><p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: 11, textTransform: 'uppercase' }}>{s.l}</p></div>)}</div>

        {stats.days >= 7 && <button onClick={() => { utils.haptic(); setShowRecap(true); }} style={{ width: '100%', padding: 16, background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.2))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 24 }}>View Quarter Insights →</button>}

        {pastQuarters.length > 0 && <div><h3 style={{ margin: '0 0 14px', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Past Quarters</h3><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{pastQuarters.map(pq => { const data = getPastQ(pq); return <button key={pq} onClick={() => { utils.haptic(); setViewQ(pq); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 18, background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: 14, cursor: 'pointer', width: '100%', textAlign: 'left' }}><div><p style={{ color: '#fff', margin: '0 0 4px', fontSize: 16, fontWeight: 500 }}>{pq.replace('-', ' ')}</p><p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: 13 }}>{data.goals.length} goals · {data.done} done</p></div><span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }}>›</span></button>; })}</div></div>}

        {!stats.days && !pastQuarters.length && <div style={{ textAlign: 'center', padding: 32, background: 'rgba(255,255,255,0.02)', borderRadius: 14 }}><p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', fontSize: 24 }}>📝</p><p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: 15 }}>Your history will appear here</p></div>}
      </div>
    );
  };

  const Recap = () => {
    const rate = stats.days ? Math.round((stats.yes/stats.days)*100) : 0;
    const ins = [];
    if (rate >= 70) ins.push({ i: '🔥', t: `${rate}% follow-through. That's real commitment.` });
    else if (rate >= 50) ins.push({ i: '💪', t: `${rate}% is solid. Room to grow next quarter.` });
    else if (rate > 0) ins.push({ i: '🌱', t: `${rate}% is a start. You showed up, and that matters.` });
    if (stats.done > 0) ins.push({ i: '🎯', t: `You completed ${stats.done} objectives. Real progress.` });
    if (stats.partial > 0) ins.push({ i: '◐', t: `${stats.partial} partial days still count as effort.` });

    return (
      <div style={{ padding: '24px 24px calc(env(safe-area-inset-bottom, 20px) + 24px)', maxWidth: 500, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 36, paddingTop: 'calc(env(safe-area-inset-top, 0) + 20px)' }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 36 }}>{rate >= 70 ? '🏆' : rate >= 50 ? '⭐' : '🌟'}</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 300, color: '#fff' }}>{qtr.label} Insights</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: 15 }}>Here's how it's going</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 22, textAlign: 'center' }}><p style={{ color: '#22c55e', margin: 0, fontSize: 40, fontWeight: 300 }}>{stats.days}</p><p style={{ color: 'rgba(255,255,255,0.4)', margin: '6px 0 0', fontSize: 13 }}>Days Tracked</p></div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 22, textAlign: 'center' }}><p style={{ color: '#3b82f6', margin: 0, fontSize: 40, fontWeight: 300 }}>{stats.done}</p><p style={{ color: 'rgba(255,255,255,0.4)', margin: '6px 0 0', fontSize: 13 }}>Objectives Done</p></div>
        </div>

        {stats.days > 0 && <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 24 }}><h3 style={{ margin: '0 0 14px', color: '#fff', fontSize: 15, fontWeight: 600 }}>Daily Outcomes</h3><div style={{ display: 'flex', gap: 4, marginBottom: 12, height: 12, borderRadius: 6, overflow: 'hidden' }}>{stats.yes > 0 && <div style={{ flex: stats.yes, background: '#22c55e' }} />}{stats.partial > 0 && <div style={{ flex: stats.partial, background: '#eab308' }} />}{stats.no > 0 && <div style={{ flex: stats.no, background: '#ef4444' }} />}</div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: '#22c55e' }}>✓ {stats.yes}</span><span style={{ color: '#eab308' }}>◐ {stats.partial}</span><span style={{ color: '#ef4444' }}>✗ {stats.no}</span></div></div>}

        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 24 }}><h3 style={{ margin: '0 0 18px', color: '#fff', fontSize: 15, fontWeight: 600 }}>Goal Progress</h3>{goals.map((g, i) => { const p = utils.progress(g.objs); return <div key={g.id} style={{ marginBottom: i < goals.length-1 ? 18 : 0 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: '#fff', fontSize: 15 }}>{g.name}</span><span style={{ color: p >= 70 ? '#22c55e' : p >= 40 ? '#eab308' : 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: 600 }}>{p}%</span></div><Bar p={p} c={p >= 70 ? '#22c55e' : p >= 40 ? '#eab308' : 'rgba(255,255,255,0.3)'} /></div>; })}</div>

        {ins.length > 0 && <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))', borderRadius: 16, padding: 20, marginBottom: 32, border: '1px solid rgba(139,92,246,0.2)' }}><h3 style={{ margin: '0 0 18px', color: '#fff', fontSize: 15, fontWeight: 600 }}>Insights</h3>{ins.map((x, i) => <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: i < ins.length-1 ? 14 : 0 }}><span style={{ fontSize: 22 }}>{x.i}</span><p style={{ color: 'rgba(255,255,255,0.8)', margin: 0, fontSize: 15, lineHeight: 1.5 }}>{x.t}</p></div>)}</div>}

        <button onClick={() => setShowRecap(false)} style={{ width: '100%', padding: 18, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 14, color: '#fff', fontSize: 16, fontWeight: 500, cursor: 'pointer' }}>Back to Dashboard</button>
      </div>
    );
  };

  const Settings = () => {
    const handleToggleMorning = async (enabled) => {
      if (enabled && !pushSubscribed) {
        try {
          await subscribeToPush()
          setPushSubscribed(true)
          showToast('Notifications enabled')
        } catch (error) {
          showToast('Failed to enable notifications')
          console.error(error)
          return
        }
      }
      
      setNotifMorning(enabled)
      await updateNotificationPreferences(enabled, notifEvening)
      utils.haptic()
    }
    
    const handleToggleEvening = async (enabled) => {
      if (enabled && !pushSubscribed) {
        try {
          await subscribeToPush()
          setPushSubscribed(true)
          showToast('Notifications enabled')
        } catch (error) {
          showToast('Failed to enable notifications')
          console.error(error)
          return
        }
      }
      
      setNotifEvening(enabled)
      await updateNotificationPreferences(notifMorning, enabled)
      utils.haptic()
    }
    
    const handleUnsubscribe = async () => {
      try {
        await unsubscribeFromPush()
        setPushSubscribed(false)
        setNotifMorning(false)
        setNotifEvening(false)
        await updateNotificationPreferences(false, false)
        showToast('Notifications disabled')
        utils.haptic()
      } catch (error) {
        showToast('Failed to disable notifications')
        console.error(error)
      }
    }
    
    return (
      <div style={{ padding: '24px 24px calc(env(safe-area-inset-bottom, 20px) + 24px)', maxWidth: 500, margin: '0 auto' }}>
        <div style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}><Back fn={() => setView('home')} /></div>
        <div style={{ marginBottom: 32 }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase' }}>Settings</p>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 300, color: '#fff' }}>Notifications</h1>
        </div>
        
        {!pushSupported ? (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: 15 }}>Push notifications are not supported in this browser</p>
          </div>
        ) : (
          <>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <p style={{ color: '#fff', margin: '0 0 4px', fontSize: 16, fontWeight: 500 }}>Morning reminder</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: 13 }}>8:00 AM</p>
                </div>
                <button
                  onClick={() => handleToggleMorning(!notifMorning)}
                  disabled={!pushSubscribed && !notifMorning}
                  style={{
                    width: 52,
                    height: 32,
                    borderRadius: 16,
                    background: (pushSubscribed && notifMorning) ? '#3b82f6' : 'rgba(255,255,255,0.2)',
                    border: 'none',
                    cursor: (!pushSubscribed && !notifMorning) ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    transition: 'background 0.3s',
                    opacity: (!pushSubscribed && !notifMorning) ? 0.5 : 1
                  }}
                >
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 4,
                    left: (pushSubscribed && notifMorning) ? 24 : 4,
                    transition: 'left 0.3s'
                  }} />
                </button>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.3)', margin: '12px 0 0', fontSize: 12 }}>Set your 60-second intention</p>
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <p style={{ color: '#fff', margin: '0 0 4px', fontSize: 16, fontWeight: 500 }}>Evening reminder</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: 13 }}>8:00 PM</p>
                </div>
                <button
                  onClick={() => handleToggleEvening(!notifEvening)}
                  disabled={!pushSubscribed && !notifEvening}
                  style={{
                    width: 52,
                    height: 32,
                    borderRadius: 16,
                    background: (pushSubscribed && notifEvening) ? '#8b5cf6' : 'rgba(255,255,255,0.2)',
                    border: 'none',
                    cursor: (!pushSubscribed && !notifEvening) ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    transition: 'background 0.3s',
                    opacity: (!pushSubscribed && !notifEvening) ? 0.5 : 1
                  }}
                >
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 4,
                    left: (pushSubscribed && notifEvening) ? 24 : 4,
                    transition: 'left 0.3s'
                  }} />
                </button>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.3)', margin: '12px 0 0', fontSize: 12 }}>Do your 90-second reflection</p>
            </div>
            
            {pushSubscribed && (
              <>
                <button
                  onClick={async () => {
                    try {
                      utils.haptic()
                      await sendTestPush()
                      showToast('Test notification sent!')
                    } catch (error) {
                      showToast('Failed to send test: ' + (error.message || 'Unknown error'))
                      console.error(error)
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: 14,
                    marginBottom: 12,
                    background: 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: 12,
                    color: '#3b82f6',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Send test push
                </button>
                <button
                  onClick={handleUnsubscribe}
                  style={{
                    width: '100%',
                    padding: 14,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                >
                  Disable all notifications
                </button>
              </>
            )}
          </>
        )}
      </div>
    )
  }

  const Onboard = () => (
    <div style={{ padding: '24px 24px calc(env(safe-area-inset-bottom, 20px) + 24px)', maxWidth: 500, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ marginBottom: 40, textAlign: 'center', paddingTop: 'env(safe-area-inset-top, 0)' }}>
        <img src="/icon-192.png" alt="Reflect" style={{ width: 64, height: 64, borderRadius: 16, margin: '0 auto 24px', display: 'block', objectFit: 'contain' }} />
        <h1 style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 300, color: '#fff' }}>Reflect</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: 15 }}>Set your goals for {qtr.label}</p>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 28, textAlign: 'center', lineHeight: 1.6, fontSize: 16 }}>What 3 things would make the next 90 days successful?</p>
      {[0,1,2].map(i => <div key={i} style={{ marginBottom: 18 }}><label style={{ display: 'block', color: 'rgba(255,255,255,0.3)', marginBottom: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Goal {i+1}</label><input value={obGoals[i]} onChange={(e) => { const n = [...obGoals]; n[i] = e.target.value; setObGoals(n); }} placeholder={i===0 ? "e.g., Get stronger" : i===1 ? "e.g., Write my book" : "e.g., Be more present"} style={{ width: '100%', padding: '16px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#fff', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} /></div>)}
      <button onClick={createGoals} disabled={!obGoals.some(g => g.trim())} style={{ width: '100%', padding: 18, marginTop: 16, background: obGoals.some(g => g.trim()) ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 14, color: obGoals.some(g => g.trim()) ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 17, fontWeight: 600, cursor: obGoals.some(g => g.trim()) ? 'pointer' : 'not-allowed' }}>Get Started</button>
      {goals.length > 0 && <button onClick={() => setOnboard(false)} style={{ width: '100%', marginTop: 12, padding: 14, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>}
    </div>
  );

  const Closed = () => <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}><div style={{ textAlign: 'center', padding: 24 }}><div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', animation: 'scaleIn 0.3s ease' }}><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20,6 9,17 4,12" /></svg></div><h2 style={{ margin: 0, fontSize: 30, fontWeight: 300, color: '#fff' }}>Day Closed</h2><p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 10, fontSize: 16 }}>Rest well. Tomorrow's a fresh start.</p></div></div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", color: '#fff', WebkitFontSmoothing: 'antialiased' }}>
      <style>{`* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; } input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.25); } @keyframes scaleIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
      <Toast />
      {closed && <Closed />}
      {showRecap ? <Recap /> : onboard ? <Onboard /> : view==='home' ? <Home /> : view==='morning' ? <Morning /> : view==='evening' ? <Evening /> : view==='settings' ? <Settings /> : <History />}
    </div>
  );
}
