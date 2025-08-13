/* ======== GLOBAL STATE (localStorage) ======== */
const STORAGE_KEY = 'aqua_reports';

function getReports(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e){ return []; }
}
function saveReports(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }

/* ======== AUTH (localStorage) ======== */
const SESSION_KEY = 'aqua_user';
const USERS_KEY = 'aqua_users';

function getUsers(){
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
  catch(e){ return []; }
}
function saveUsers(arr){ localStorage.setItem(USERS_KEY, JSON.stringify(arr)); }

function ensureSeedUser(){
  const users = getUsers();
  if(!users.find(u => u.email === 'aditya@gmail.com')){
    users.push({ email:'aditya@gmail.com', name:'Aditya', password:'aditya123' });
    saveUsers(users);
  }
}

function setSession(user, remember=false){
  const data = { email:user.email, name:user.name||user.email, ts:Date.now() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}
function getSession(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch(e){ return null; }
}
function clearSession(){ localStorage.removeItem(SESSION_KEY); }

function renderAuthLinks(){
  const container = document.querySelector('.nav .navlinks');
  if(!container) return;
  container.querySelector('.auth-slot')?.remove();
  const slot = document.createElement('span');
  slot.className = 'auth-slot';
  const session = getSession();
  if(session){
    slot.innerHTML = `
      <span class="helper">Hi, ${session.name || session.email}</span>
      <button id="btn-logout" class="linkbtn" style="margin-left:10px">Logout</button>
    `;
  } else {
    slot.innerHTML = `<a href="signin.html">Sign In</a>`;
  }
  container.appendChild(slot);
  const logoutBtn = slot.querySelector('#btn-logout');
  if(logoutBtn){
    logoutBtn.addEventListener('click', ()=>{
      if(confirm('Log out?')){ clearSession(); window.location.href = 'index.html'; }
    });
  }
}

function initSignin(){
  const form = document.getElementById('signin-form');
  if(!form) return;
  ensureSeedUser();

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember')?.checked;
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email && u.password === password);
    if(!user){
      alert('Invalid email or password');
      return;
    }
    setSession(user, remember);
    window.location.href = 'index.html';
  });
}

function enforceAuthIfProtected(){
  const protectedPages = ['dashboard', 'report'];
  const page = document.body.dataset.page;
  const isProtected = protectedPages.includes(page);
  if(isProtected && !getSession()){
    alert('You must be signed in to view this page.');
    window.location.replace('signin.html');
  }
}

/* ======== NAVBAR ======== */
(function(){
  const burger = document.querySelector('.burger');
  const links = document.querySelector('.navlinks');
  if(burger && links){
    burger.addEventListener('click', ()=> {
      const isOpen = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(isOpen));
    });
  }
})();

/* ======== COUNTERS & DASHBOARD ======== */
function animateCount(el, to, duration=800){
  const start = 0, startTime = performance.now();
  function tick(now){
    const p = Math.min((now - startTime)/duration, 1);
    el.textContent = Math.round(start + (to - start) * (p<.5 ? 2*p*p : -1 + (4 - 2*p)*p));
    if(p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function initDashboard(){
  const reports = getReports();
  const safe = reports.filter(r => (r.issueType || '').toLowerCase().includes('safe')).length;
  const alerts = reports.length - safe;
  const improvement = reports.length > 0 ? Math.round((safe / reports.length) * 100) : 0;
  const elOverview = document.querySelector('[data-stat="overview"]');
  const elSafe = document.querySelector('[data-stat="safe"]');
  const elAlerts = document.querySelector('[data-stat="alerts"]');
  const elImprove = document.querySelector('[data-stat="improve"]');
  if(elOverview) animateCount(elOverview, reports.length);
  if(elSafe) animateCount(elSafe, safe);
  if(elAlerts) animateCount(elAlerts, alerts);
  if(elImprove) animateCount(elImprove, improvement);

  const ctx1 = document.getElementById('issuesChart');
  if(ctx1 && window.Chart){
    const byType = reports.reduce((acc,r)=>{ acc[r.issueType||'Other'] = (acc[r.issueType||'Other'] || 0) + 1; return acc; },{});
    new Chart(ctx1, { type:'doughnut', data:{ labels:Object.keys(byType), datasets:[{data:Object.values(byType)}] }, options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } } });
  }

  const ctx2 = document.getElementById('trendChart');
  if(ctx2 && window.Chart){
    const byMonth = {};
    reports.forEach(r=>{ const d = new Date(r.createdAt||Date.now()); const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; byMonth[key] = (byMonth[key] || 0) + 1; });
    const labels = Object.keys(byMonth).sort();
    new Chart(ctx2,{ type:'line', data:{ labels, datasets:[{ label:'Reports', data: labels.map(l=>byMonth[l]) }] }, options:{ responsive:true, plugins:{ legend:{ display:false } }, tension:.35 } });
  }

  const list = document.getElementById('recent-list');
  if(list){
    list.innerHTML = reports.slice(-6).reverse().map(r=> `<li><strong>${r.issueType || 'Issue'}</strong> · ${r.waterType || 'Water body'} <span class="helper">(${(r.locationText||'').slice(0,40)}${(r.locationText||'').length>40?'…':''})</span></li>`).join('') || '<li class="helper">No reports yet.</li>';
  }
}

/* ======== MARKER STYLE ======== */
const BASE_STYLE = {
  color: '#ff0000',
  weight: 2,
  fillColor: '#ff0000',
  fillOpacity: 0.5
};
function getMarkerRadius(zoom) {
  return Math.max(4, 6 + (zoom - 5) * 0.8);
}

/* ======== MAP (Water Map page) ======== */
function initMap(){
  const mapEl = document.getElementById('map');
  if(!mapEl || !window.L) return;
  const map = L.map('map', { scrollWheelZoom:true }).setView([22.97, 78.65], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);

  const reports = getReports();
  const markers = [];
  reports.forEach(r=>{
    if(r.lat && r.lng){
      const marker = L.circleMarker([r.lat, r.lng], { ...BASE_STYLE, radius: getMarkerRadius(map.getZoom()) }).addTo(map).bindPopup(`<strong>${r.issueType||'Issue'}</strong><br>${r.waterType||''}<br><small>${r.locationText||''}</small>`).on('click', () => { map.setView([r.lat, r.lng], 14, { animate: true }); });
      markers.push(marker);
    }
  });

  map.on('zoomend', () => { const zoom = map.getZoom(); markers.forEach(m => m.setStyle({ radius: getMarkerRadius(zoom) })); });

  const wrap = document.querySelector('.map-wrap');
  const btn = document.getElementById('btn-fullscreen');
  if(btn && wrap){
    btn.addEventListener('click', ()=>{
      const isFull = wrap.classList.toggle('fullscreen');
      btn.setAttribute('aria-pressed', String(isFull));
      setTimeout(()=> map.invalidateSize(), 60);
    });
  }
}

/* ======== REPORT FORM ======== */
function initReport(){
  const mapEl = document.getElementById('report-map');
  const form = document.getElementById('report-form');
  const locField = document.getElementById('location');
  const latField = document.getElementById('lat');
  const lngField = document.getElementById('lng');

  if(!mapEl || !window.L) return;

  const map = L.map('report-map').setView([22.97,78.65], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ maxZoom:19, attribution:'&copy; OpenStreetMap' }).addTo(map);

  let marker;
  function place(latlng){
    if(marker){ 
      marker.setLatLng(latlng); 
    } else { 
      marker = L.circleMarker(latlng, { ...BASE_STYLE, radius: getMarkerRadius(map.getZoom()) })
        .addTo(map)
        .on('click', () => { map.setView(latlng, 14, { animate: true }); }); 
    }
    latField.value = latlng.lat.toFixed(6);
    lngField.value = latlng.lng.toFixed(6);
  }

  map.on('zoomend', () => { if(marker) marker.setStyle({ radius: getMarkerRadius(map.getZoom()) }); });
  map.on('click', e => place(e.latlng));

  const geoBtn = document.getElementById('btn-locate');
  if(geoBtn && navigator.geolocation){
    geoBtn.addEventListener('click', ()=>{
      navigator.geolocation.getCurrentPosition(pos=>{ 
        const latlng = {lat:pos.coords.latitude, lng:pos.coords.longitude}; 
        map.setView(latlng, 14); 
        place(latlng); 
      }, ()=> alert('Unable to get your location.'));
    });
  }
  

  if(form){
    form.addEventListener('submit',(e)=>{
      e.preventDefault();
      const requiredIds = ['waterType','issueType','description'];
      let ok = true;
      requiredIds.forEach(id=>{
        const f = document.getElementById(id);
        if(!f.value.trim()){ f.setAttribute('aria-invalid','true'); ok=false; }
        else f.removeAttribute('aria-invalid');
      });
      if(!latField.value || !lngField.value){ alert('Please click the map to set a location.'); ok=false; }
      if(!ok) return;

      const reports = getReports();
      const session = getSession();
      const payload = {
        reporter: session ? session.email : 'anonymous',
        locationText: locField.value.trim(),
        lat: Number(latField.value), lng: Number(lngField.value),
        waterType: document.getElementById('waterType').value,
        issueType: document.getElementById('issueType').value,
        description: document.getElementById('description').value.trim(),
        createdAt: Date.now()
      };
      reports.push(payload); saveReports(reports);
      form.reset(); latField.value=''; lngField.value='';
      alert('✅ Report submitted! It will appear on the Dashboard and Water Map.');
      window.location.href = 'dashboard.html';
    });
  }
}

/* ======== CONTACT FORM ======== */
function initContact(){
    const form = document.getElementById('contact-form');
    if(form){
        form.addEventListener('submit', (e)=>{
            e.preventDefault();
            const name = form.querySelector('#name').value.trim();
            if(!name){ alert('Please fill out all fields.'); return; }
            alert(`Thank you, ${name}! Your message has been sent.`);
            form.reset();
        });
    }
}

/* ======== CHATBOT ======== */
function initChatbot() {
  const toggleButton = document.getElementById('chat-toggle');
  const closeButton = document.getElementById('chat-close');
  const chatWindow = document.getElementById('chat-window');
  const messagesContainer = document.getElementById('chat-messages');
  const optionsContainer = document.getElementById('chat-options');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');

  if (!toggleButton || !chatWindow) return;

  const toggleChat = () => chatWindow.classList.toggle('open');
  toggleButton.addEventListener('click', toggleChat);
  closeButton.addEventListener('click', toggleChat);

  const addMessage = (text, sender) => {
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${sender}`;
    messageEl.innerHTML = text;
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  const getBotResponse = (userInput) => {
    const input = userInput.toLowerCase();
    const intents = {
        greeting: { keywords: ['hello', 'hi', 'hey', 'yo', 'greetings'], response: 'Hello! How can I help you today?' },
        reporting: { keywords: ['report', 'issue', 'submit', 'add', 'how', 'problem', 'complain'], response: 'You can report an issue by navigating to the <a href="report.html">Report Issue</a> page.' },
        map: { keywords: ['map', 'view', 'locations', 'hotspots', 'see', 'find'], response: 'Sure, you can view the <a href="map.html">Water Map</a> to see all reported locations.' },
        mission: { keywords: ['about', 'mission', 'purpose', 'goal', 'what', 'this', 'site', 'who'], response: 'Aqua Alert empowers citizens to protect India’s water by making it simple to report issues, visualize hotspots, and track improvements.' },
        dataSource: { keywords: ['data', 'source', 'accurate', 'verify', 'trust', 'real'], response: 'The data on our platform is crowdsourced directly from citizens like you.' },
        account: { keywords: ['account', 'login', 'register', 'sign up', 'password'], response: 'You don\'t need an account to report, but signing in allows you to track your contributions.' },
        cost: { keywords: ['cost', 'free', 'price', 'charge', 'pay'], response: 'Aqua Alert is a completely free, community-driven platform.' },
        help: { keywords: ['help', 'support', 'contact'], response: 'If you need help, you can visit our <a href=\'contact.html\'>Contact</a> page.' },
        botIdentity: { keywords: ['bot', 'ai', 'who are you'], response: 'I\'m the Aqua Assistant, a bot designed to help you navigate this site.' },
        thanks: { keywords: ['thanks', 'thank you', 'cool', 'ok', 'awesome'], response: 'You\'re welcome! Is there anything else I can help with?' }
    };
    let bestMatch = { intent: null, score: 0 };
    for (const intentName in intents) {
        const intent = intents[intentName];
        let score = 0;
        intent.keywords.forEach(keyword => { if (input.includes(keyword)) { score++; } });
        if (score > bestMatch.score) { bestMatch = { intent: intentName, score: score }; }
    }
    if (bestMatch.score > 0) { return intents[bestMatch.intent].response; }
    return "I'm sorry, I don't understand that. You can ask me about reporting an issue, viewing the map, or the purpose of this site.";
  };

  const handleUserInput = (text) => {
    addMessage(text, 'user');
    setTimeout(() => { addMessage(getBotResponse(text), 'bot'); }, 600);
  };
  
  optionsContainer.addEventListener('click', (e) => { if (e.target.classList.contains('chat-option')) { handleUserInput(e.target.textContent); } });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userText = chatInput.value.trim();
    if (userText) { handleUserInput(userText); chatInput.value = ''; }
  });
  
  setTimeout(() => { addMessage('Hello! I am the Aqua Assistant. How can I help you?', 'bot'); }, 1000);
}


/* ======== INIT BY PAGE ======== */
document.addEventListener('DOMContentLoaded', ()=>{
  // Run auth on every page
  renderAuthLinks();
  enforceAuthIfProtected();

  // Run page-specific scripts
  const page = document.body.dataset.page;
  if(document.getElementById('map')) initMap();
  if(document.getElementById('report-form')) initReport();
  if(document.getElementById('contact-form')) initContact();
  if(document.getElementById('signin-form')) initSignin();
  if(document.getElementById('chat-toggle')) initChatbot();
  
  if(page === 'home' || page === 'dashboard') {
    initDashboard();
  }
});
