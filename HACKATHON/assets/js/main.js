/* ======== GLOBAL STATE (localStorage) ======== */
const STORAGE_KEY = 'aqua_reports';

function getReports(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e){ return []; }
}
function saveReports(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }

/* ======== NAVBAR ======== */
(function(){
  const burger = document.querySelector('.burger');
  const links = document.querySelector('.navlinks');
  if(burger && links){
    burger.addEventListener('click', ()=> links.classList.toggle('open'));
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
  const safe = reports.filter(r => (r.issueType||'').toLowerCase().includes('safe')).length;
  const alerts = reports.filter(r => (r.issueType||'').toLowerCase().includes('contamination') || (r.issueType||'').toLowerCase().includes('alert')).length;
  const improvement = Math.min(97, 30 + Math.floor(reports.length * 0.7)); // demo metric

  const elOverview = document.querySelector('[data-stat="overview"]');
  const elSafe = document.querySelector('[data-stat="safe"]');
  const elAlerts = document.querySelector('[data-stat="alerts"]');
  const elImprove = document.querySelector('[data-stat="improve"]');
  if(elOverview) animateCount(elOverview, reports.length);
  if(elSafe) animateCount(elSafe, safe);
  if(elAlerts) animateCount(elAlerts, alerts);
  if(elImprove) animateCount(elImprove, improvement);

  // Chart.js (if present)
  const ctx1 = document.getElementById('issuesChart');
  if(ctx1 && window.Chart){
    const byType = reports.reduce((acc,r)=>{ acc[r.issueType||'Other']=(acc[r.issueType||'Other']||0)+1; return acc },{});
    new Chart(ctx1, {
      type:'doughnut',
      data:{
        labels:Object.keys(byType),
        datasets:[{data:Object.values(byType)}]
      },
      options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } }
    });
  }
  const ctx2 = document.getElementById('trendChart');
  if(ctx2 && window.Chart){
    // simple monthly trend from timestamps
    const byMonth = {};
    reports.forEach(r=>{
      const d = new Date(r.createdAt||Date.now());
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      byMonth[key]=(byMonth[key]||0)+1;
    });
    const labels = Object.keys(byMonth).sort();
    new Chart(ctx2,{
      type:'line',
      data:{ labels, datasets:[{ label:'Reports', data: labels.map(l=>byMonth[l]) }] },
      options:{ responsive:true, plugins:{ legend:{ display:false } }, tension:.35 }
    });
  }

  // List recent reports if container present
  const list = document.getElementById('recent-list');
  if(list){
    list.innerHTML = reports.slice(-6).reverse().map(r=>`
      <li>
        <strong>${r.issueType || 'Issue'}</strong> · ${r.waterType || 'Water body'} 
        <span class="helper">(${(r.locationText||'').slice(0,40)}${(r.locationText||'').length>40?'…':''})</span>
      </li>
    `).join('') || '<li class="helper">No reports yet.</li>';
  }
}

/* ======== MAP (Water Map page) ======== */
function initMap(){
  const mapEl = document.getElementById('map');
  if(!mapEl || !window.L) return;
  const map = L.map('map', { scrollWheelZoom:true }).setView([22.97, 78.65], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  const redIcon = new L.Icon({
    iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34], shadowSize:[41,41],
    className:'red-tint'
  });
  const style = document.createElement('style');
  style.textContent = `.red-tint{ filter:hue-rotate(-150deg) saturate(2) }`;
  document.head.appendChild(style);

  const reports = getReports();
  reports.forEach(r=>{
    if(r.lat && r.lng){
      L.marker([r.lat, r.lng], { icon:redIcon })
        .addTo(map)
        .bindPopup(`<strong>${r.issueType||'Issue'}</strong><br>${r.waterType||''}<br><small>${r.locationText||''}</small>`);
    }
  });

  // Fullscreen toggle via CSS
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

/* ======== REPORT FORM (pinpoint + validation) ======== */
function initReport(){
  const mapEl = document.getElementById('report-map');
  const form = document.getElementById('report-form');
  const locField = document.getElementById('location');
  const latField = document.getElementById('lat');
  const lngField = document.getElementById('lng');

  if(mapEl && window.L){
    const map = L.map('report-map').setView([22.97,78.65], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19, attribution:'&copy; OpenStreetMap'
    }).addTo(map);
    let marker;
    function place(latlng){
      if(marker){ marker.setLatLng(latlng); }
      else { marker = L.marker(latlng).addTo(map); }
      latField.value = latlng.lat.toFixed(6);
      lngField.value = latlng.lng.toFixed(6);
    }
    map.on('click', e => place(e.latlng));

    // Geolocate button
    const geoBtn = document.getElementById('btn-locate');
    if(geoBtn && navigator.geolocation){
      geoBtn.addEventListener('click', ()=>{
        navigator.geolocation.getCurrentPosition(pos=>{
          const latlng = {lat:pos.coords.latitude, lng:pos.coords.longitude};
          map.setView(latlng, 14); place(latlng);
        }, ()=> alert('Unable to get your location.'));
      });
    }
  }

  if(form){
    form.addEventListener('submit',(e)=>{
      e.preventDefault();
      // Basic validation
      const requiredIds = ['waterType','issueType','description','name','contact'];
      let ok = true;
      requiredIds.forEach(id=>{
        const f = document.getElementById(id);
        if(!f.value.trim()){ f.setAttribute('aria-invalid','true'); ok=false; }
        else f.removeAttribute('aria-invalid');
      });
      if(!latField.value || !lngField.value){
        alert('Please click the map to set a location (or use Locate Me).');
        ok=false;
      }
      if(!ok) return;

      const reports = getReports();
      const payload = {
        locationText: locField.value.trim(),
        lat: Number(latField.value), lng: Number(lngField.value),
        waterType: document.getElementById('waterType').value,
        issueType: document.getElementById('issueType').value,
        description: document.getElementById('description').value.trim(),
        name: document.getElementById('name').value.trim(),
        contact: document.getElementById('contact').value.trim(),
        createdAt: Date.now()
      };
      reports.push(payload); saveReports(reports);
      form.reset(); latField.value=''; lngField.value='';
      alert('✅ Report submitted! It will appear on the Dashboard and Water Map.');
      window.location.href = 'dashboard.html';
    });
  }
}

/* ======== INIT BY PAGE ======== */
document.addEventListener('DOMContentLoaded', ()=>{
  if(document.body.dataset.page==='dashboard') initDashboard();
  if(document.getElementById('map')) initMap();
  if(document.getElementById('report-form')) initReport();
});
