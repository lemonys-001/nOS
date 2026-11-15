const clock = document.getElementById('clock');
const net = document.getElementById('net');

function tick() {
  const d = new Date();
  const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  clock.textContent = day + ' · ' + t;
}
tick();
setInterval(tick, 15000);

function netState() {
  const online = navigator.onLine;
  net.classList.toggle('online', online);
  net.classList.toggle('offline', !online);
  net.textContent = online ? 'online' : 'offline — local apps still work';
}
netState();
window.addEventListener('online', netState);
window.addEventListener('offline', netState);
